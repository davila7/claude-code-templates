"""Cross-reference engine: combines graph topology with static analysis metrics.

Reads graphify's graph.json and radon/ruff outputs, produces risk-scored
nodes, community health, and complexity contagion chains.

Usage:
    python crossref.py analyze <src_path>
    python crossref.py report
    python crossref.py html
"""

import json
import math
import re
import subprocess
import sys
from collections import defaultdict
from pathlib import Path


def ensure_graph_exists(src_path, graph_path="graphify-out/graph.json"):
    """Ensure a graph.json exists; build AST-only graph if missing.

    This is the fallback path for new users who don't have the /graphify
    skill installed. It uses the graphifyy Python library directly to do:
      1. File detection (tree-sitter compatible extensions)
      2. AST extraction (deterministic, no LLM needed)
      3. Leiden clustering (community detection)
      4. Export to graph.json in graphify's standard format

    Skips the semantic extraction pass (which requires Claude subagents).
    Loses ~15% of insight but adds zero install friction.

    If graph.json already exists, this is a no-op.
    """
    graph_file = Path(graph_path)
    if graph_file.exists():
        return False  # Already exists, nothing to do

    print("No graph.json found. Building AST-only graph...")
    print("  (For semantic edges, install the /graphify skill.)")

    try:
        from graphify.detect import detect
        from graphify.extract import collect_files, extract
        from graphify.build import build_from_json
        from graphify.cluster import cluster
        from graphify.export import to_json
    except ImportError:
        print(
            "ERROR: graphifyy package not found. Run: pip install graphifyy"
        )
        sys.exit(1)

    src = Path(src_path)
    if not src.exists():
        print(f"ERROR: Source path not found: {src_path}")
        sys.exit(1)

    # Step 1: Detect code files
    detection = detect(src)
    code_files = []
    for f in detection.get("files", {}).get("code", []):
        p = Path(f)
        if p.is_dir():
            code_files.extend(collect_files(p))
        else:
            code_files.append(p)

    if not code_files:
        print(f"ERROR: No code files found in {src_path}")
        sys.exit(1)

    print(f"  Extracting AST from {len(code_files)} files...")

    # Step 2: AST extraction (no LLM)
    extraction = extract(code_files)
    nodes_count = len(extraction.get("nodes", []))
    edges_count = len(extraction.get("edges", []))
    print(f"  AST: {nodes_count} nodes, {edges_count} edges")

    if nodes_count == 0:
        print("ERROR: AST extraction produced no nodes")
        sys.exit(1)

    # Step 3: Build graph + cluster
    print("  Clustering communities (Leiden)...")
    G = build_from_json(extraction)
    communities = cluster(G)
    print(f"  Found {len(communities)} communities")

    # Step 4: Export in graphify's standard format
    graph_file.parent.mkdir(parents=True, exist_ok=True)
    to_json(G, communities, str(graph_file))

    print(f"  Wrote {graph_file}")
    return True  # Graph was built


def load_graph(graph_path="graphify-out/graph.json"):
    """Load graphify's graph.json into adjacency structures."""
    data = json.loads(Path(graph_path).read_text())
    nodes = {}
    edges = []
    for node in data.get("nodes", []):
        nid = node.get("id", "")
        nodes[nid] = {
            "id": nid,
            "label": node.get("label", nid),
            "source_file": node.get("source_file", ""),
            "community": node.get("community"),
            "degree": 0,
        }
    for link in data.get("links", []):
        src = link.get("source", "")
        tgt = link.get("target", "")
        edges.append({
            "source": src,
            "target": tgt,
            "relation": link.get("relation", ""),
            "confidence": link.get("confidence", ""),
        })
        if src in nodes:
            nodes[src]["degree"] += 1
        if tgt in nodes:
            nodes[tgt]["degree"] += 1
    return nodes, edges


def run_radon_cc(src_path):
    """Run radon CC and parse results into {file::function: cc_score}."""
    result = subprocess.run(
        ["radon", "cc", src_path, "-a", "-s", "-j",
         "--exclude", "alembic/*"],
        capture_output=True, text=True,
    )
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        return {}, 0.0

    cc_map = {}
    all_scores = []
    for filepath, blocks in data.items():
        for block in blocks:
            name = block.get("name", "")
            cc = block.get("complexity", 0)
            cc_map[f"{filepath}::{name}"] = cc
            cc_map[filepath] = max(cc_map.get(filepath, 0), cc)
            all_scores.append(cc)

    avg_cc = sum(all_scores) / len(all_scores) if all_scores else 0
    return cc_map, avg_cc


def run_radon_mi(src_path):
    """Run radon MI and parse results into {file: mi_score}."""
    result = subprocess.run(
        ["radon", "mi", src_path, "-s", "-j",
         "--exclude", "alembic/*"],
        capture_output=True, text=True,
    )
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        return {}

    mi_map = {}
    for filepath, info in data.items():
        if isinstance(info, dict):
            mi_map[filepath] = info.get("mi", 100)
        elif isinstance(info, (int, float)):
            mi_map[filepath] = info
    return mi_map


def run_radon_raw(src_path):
    """Run radon raw and parse LOC per file."""
    result = subprocess.run(
        ["radon", "raw", src_path, "-s", "-j",
         "--exclude", "alembic/*"],
        capture_output=True, text=True,
    )
    try:
        data = json.loads(result.stdout)
    except json.JSONDecodeError:
        return {}

    loc_map = {}
    for filepath, info in data.items():
        if isinstance(info, dict):
            loc_map[filepath] = info.get("loc", 0)
    return loc_map


def run_ruff(src_path):
    """Run ruff and count issues per file."""
    result = subprocess.run(
        ["ruff", "check", src_path, "--output-format=json",
         "--exclude", "alembic/"],
        capture_output=True, text=True,
    )
    try:
        issues = json.loads(result.stdout)
    except json.JSONDecodeError:
        return {}, 0

    ruff_map = defaultdict(int)
    for issue in issues:
        filepath = issue.get("filename", "")
        ruff_map[filepath] += 1
    return dict(ruff_map), len(issues)


def match_node_to_file(node, cc_map, mi_map, loc_map):
    """Best-effort match a graph node to its source file metrics.

    For CC, tries function-level match (file::label) first, falls back
    to file-level max CC. This avoids every function in a file inheriting
    the worst function's CC score.
    """
    src = node.get("source_file", "")
    label = node.get("label", "")
    if not src:
        return None, None, None

    # CC: try function-level first (filepath::function_name)
    cc = None
    if label:
        # Extract the function/class name from the label
        func_name = label.split("(")[0].split(".")[-1].strip()
        # Try exact file::func match
        for key in cc_map:
            if "::" in key and key.endswith(f"::{func_name}"):
                file_part = key.split("::")[0]
                if file_part.endswith(src) or src.endswith(file_part):
                    cc = cc_map[key]
                    break
    # Fall back to file-level CC
    if cc is None:
        cc = cc_map.get(src, None)
        if cc is None:
            for key in cc_map:
                if "::" not in key and (
                    key.endswith(src) or src.endswith(key)
                ):
                    cc = cc_map[key]
                    break

    mi = mi_map.get(src, None)
    loc = loc_map.get(src, None)

    if mi is None:
        for key in mi_map:
            if key.endswith(src) or src.endswith(key):
                mi = mi_map[key]
                break

    if loc is None:
        for key in loc_map:
            if key.endswith(src) or src.endswith(key):
                loc = loc_map[key]
                break

    return cc, mi, loc


def compute_risk(degree, cc, mi):
    """Compute risk score for a node.

    risk = degree * log(CC) * (100 - MI) / 100

    - degree: how many things connect to this node
    - log(CC): complexity on a diminishing scale
    - (100-MI)/100: maintainability penalty (0=pristine, 1=unmaintainable)
    """
    if cc is None or cc < 1:
        cc = 1
    if mi is None:
        mi = 50  # assume moderate if unknown
    log_cc = math.log(max(cc, 1) + 1)
    mi_penalty = (100 - min(mi, 100)) / 100
    return round(degree * log_cc * mi_penalty, 1)


def compute_community_health(nodes, cc_map, mi_map, loc_map):
    """Compute health scores per community with per-file detail."""
    communities = defaultdict(lambda: {
        "files": set(),
        "file_details": [],
        "cc_scores": [],
        "mi_scores": [],
        "loc_total": 0,
        "node_count": 0,
        "nodes": [],
    })

    for nid, node in nodes.items():
        comm = node.get("community")
        if comm is None:
            continue
        communities[comm]["node_count"] += 1
        communities[comm]["nodes"].append(node["label"])

        src = node.get("source_file", "")
        if src and src not in communities[comm]["files"]:
            communities[comm]["files"].add(src)
            cc, mi, loc = match_node_to_file(node, cc_map, mi_map, loc_map)
            if cc is not None:
                communities[comm]["cc_scores"].append(cc)
            if mi is not None:
                communities[comm]["mi_scores"].append(mi)
            if loc is not None:
                communities[comm]["loc_total"] += loc
            communities[comm]["file_details"].append({
                "file": src,
                "cc": cc,
                "mi": round(mi, 1) if mi else None,
                "loc": loc,
            })

    # Collect cross-community edges
    edge_communities = defaultdict(lambda: defaultdict(int))
    for nid, node in nodes.items():
        comm = node.get("community")
        if comm is None:
            continue
        degree = node.get("degree", 0)
        if degree > 0:
            # Approximate: high-degree nodes likely connect outside
            edge_communities[comm][comm] += 1

    health = {}
    for comm_id, data in communities.items():
        avg_cc = (
            sum(data["cc_scores"]) / len(data["cc_scores"])
            if data["cc_scores"] else 0
        )
        avg_mi = (
            sum(data["mi_scores"]) / len(data["mi_scores"])
            if data["mi_scores"] else 100
        )

        if avg_cc > 20 or avg_mi < 30:
            status = "CRITICAL"
        elif avg_cc > 8 or avg_mi < 50:
            status = "WARN"
        else:
            status = "GOOD"

        # Sort file details by CC descending
        file_details = sorted(
            data["file_details"],
            key=lambda f: f["cc"] or 0,
            reverse=True,
        )

        # Generate recommendation
        recommendations = []
        if avg_cc > 20:
            worst = file_details[0] if file_details else None
            if worst:
                fname = worst["file"].split("/")[-1]
                recommendations.append(
                    f"Split complex functions in {fname} (CC={worst['cc']})"
                )
        if avg_mi < 40:
            recommendations.append(
                "Reduce nesting and simplify conditionals across this module"
            )
        if data["loc_total"] > 2000:
            recommendations.append(
                f"Consider splitting — {data['loc_total']} LOC is large "
                f"for {len(data['files'])} files"
            )
        if not recommendations:
            recommendations.append("No immediate action needed")

        health[comm_id] = {
            "avg_cc": round(avg_cc, 1),
            "avg_mi": round(avg_mi, 1),
            "files": len(data["files"]),
            "nodes": data["node_count"],
            "loc": data["loc_total"],
            "status": status,
            "sample_nodes": data["nodes"][:5],
            "file_details": file_details[:10],
            "recommendations": recommendations,
        }

    return health


def compute_architecture_metrics(nodes, edges):
    """Compute Clean Architecture metrics at the community level.

    Returns per-community:
    - fan_in:  edges arriving from other communities
    - fan_out: edges leaving to other communities
    - stability: S = fan_out / (fan_in + fan_out)
                 0 = stable (nothing leaves, everything arrives)
                 1 = unstable (everything leaves, nothing arrives)
    - abstraction: A = abstract_nodes / total_nodes (rough heuristic)
    - distance: D = |A + S - 1|  (distance from Main Sequence)
                0 = on the main sequence (ideal)
                1 = zone of pain OR uselessness

    Also detects cycles in the community-level dependency graph.
    """
    # Build community-level dependency graph
    comm_of = {}
    for nid, node in nodes.items():
        c = node.get("community")
        if c is not None:
            comm_of[nid] = c

    # Count cross-community edges
    fan_in = defaultdict(lambda: defaultdict(int))   # {to_comm: {from_comm: count}}
    fan_out = defaultdict(lambda: defaultdict(int))  # {from_comm: {to_comm: count}}
    call_like = {"calls", "references", "implements", "imports_from"}

    for edge in edges:
        src = edge.get("source", "")
        tgt = edge.get("target", "")
        rel = edge.get("relation", "")
        if rel not in call_like:
            continue
        s_comm = comm_of.get(src)
        t_comm = comm_of.get(tgt)
        if s_comm is None or t_comm is None or s_comm == t_comm:
            continue
        fan_out[s_comm][t_comm] += 1
        fan_in[t_comm][s_comm] += 1

    # Community abstraction: heuristic based on node labels
    # Python lacks explicit abstract keyword — we approximate via:
    # - ABC subclasses (label contains "ABC")
    # - Protocol classes
    # - Pydantic BaseModel (schema-only, no logic)
    # - Classes whose label ends with "Protocol", "Interface", "Base"
    abstract_markers = (
        "abc", "protocol", "basemodel", "interface",
        "abstract", "enum",
    )

    community_totals = defaultdict(int)
    community_abstract = defaultdict(int)
    for nid, node in nodes.items():
        c = comm_of.get(nid)
        if c is None:
            continue
        label = str(node.get("label", "")).lower()
        # Only count "class-like" nodes
        if any(m in label for m in ["class", "model", "schema", "enum"]):
            community_totals[c] += 1
            if any(m in label for m in abstract_markers):
                community_abstract[c] += 1

    # Compute metrics per community
    all_comms = set(comm_of.values())
    metrics = {}
    for c in all_comms:
        fi = sum(fan_in.get(c, {}).values())
        fo = sum(fan_out.get(c, {}).values())
        total = fi + fo
        stability = round(fo / total, 3) if total > 0 else 0.0

        total_classes = community_totals.get(c, 0)
        abstract_classes = community_abstract.get(c, 0)
        abstraction = (
            round(abstract_classes / total_classes, 3)
            if total_classes > 0 else 0.0
        )

        distance = round(abs(abstraction + stability - 1), 3)

        # Classify position relative to main sequence
        if distance < 0.2:
            zone = "Main Sequence"
        elif stability < 0.3 and abstraction < 0.3:
            zone = "Zone of Pain"
        elif stability > 0.7 and abstraction > 0.7:
            zone = "Zone of Uselessness"
        else:
            zone = "Off Sequence"

        metrics[c] = {
            "fan_in": fi,
            "fan_out": fo,
            "stability": stability,
            "abstraction": abstraction,
            "distance": distance,
            "zone": zone,
            "total_classes": total_classes,
            "abstract_classes": abstract_classes,
            "depends_on": sorted(
                fan_out.get(c, {}).items(),
                key=lambda x: -x[1],
            )[:5],
            "depended_by": sorted(
                fan_in.get(c, {}).items(),
                key=lambda x: -x[1],
            )[:5],
        }

    # Detect cycles using DFS on community-level graph
    adj = {c: set(fan_out.get(c, {}).keys()) for c in all_comms}
    cycles = _find_cycles(adj)

    return metrics, cycles


def _find_cycles(adj, max_cycles=10):
    """Find simple cycles in a directed graph using Tarjan-like DFS."""
    cycles = []
    visited = set()
    rec_stack = []
    rec_set = set()

    def dfs(node, start):
        if len(cycles) >= max_cycles:
            return
        rec_stack.append(node)
        rec_set.add(node)
        for neighbor in adj.get(node, ()):
            if neighbor == start and len(rec_stack) >= 2:
                cycles.append(list(rec_stack))
                continue
            if neighbor in rec_set:
                continue
            if neighbor not in visited:
                dfs(neighbor, start)
        rec_stack.pop()
        rec_set.remove(node)

    for node in list(adj.keys()):
        if node in visited:
            continue
        dfs(node, node)
        visited.add(node)

    # Deduplicate by normalized form (smallest element first)
    seen = set()
    unique = []
    for cycle in cycles:
        if len(cycle) < 2:
            continue
        # Normalize: rotate so smallest element is first
        min_idx = cycle.index(min(cycle))
        rotated = tuple(cycle[min_idx:] + cycle[:min_idx])
        if rotated not in seen:
            seen.add(rotated)
            unique.append(list(rotated))

    return unique[:max_cycles]


def find_contagion_chains(nodes, edges, cc_map, mi_map, top_n=5):
    """Find chains of high-complexity calls (complexity contagion).

    Traces call-graph edges from high-CC nodes, preferring chains that
    cross file and community boundaries (those are more dangerous).
    Deduplicates chains that share the same core path.
    """
    adj = defaultdict(list)
    for edge in edges:
        if edge["relation"] in (
            "calls", "references", "implements", "shares_data_with",
        ):
            adj[edge["source"]].append(edge["target"])

    # Get per-node CC using function-level matching
    node_cc = {}
    for nid, node in nodes.items():
        cc, _, _ = match_node_to_file(node, cc_map, mi_map, {})
        if cc and cc >= 8:
            node_cc[nid] = cc

    starts = sorted(
        node_cc.keys(), key=lambda x: node_cc[x], reverse=True,
    )

    chains = []
    seen_cores = set()  # deduplicate by core node set

    for start in starts[:top_n * 4]:
        chain = []
        visited = set()
        current = start
        total_cc = 0
        files_seen = set()

        while current and current not in visited and len(chain) < 6:
            visited.add(current)
            cc = node_cc.get(current, 0)
            if cc < 5 and chain:
                break
            node = nodes.get(current, {})
            src_file = node.get("source_file", "")
            chain.append({
                "id": current,
                "label": node.get("label", current)[:60],
                "file": src_file,
                "cc": cc,
                "community": node.get("community"),
            })
            total_cc += cc
            files_seen.add(src_file)

            # Prefer cross-file neighbors, then highest-CC
            best_next = None
            best_score = -1
            for neighbor in adj.get(current, []):
                ncc = node_cc.get(neighbor, 0)
                if neighbor in visited or ncc < 5:
                    continue
                n_file = nodes.get(neighbor, {}).get("source_file", "")
                # Bonus for crossing file boundaries
                cross_file_bonus = 20 if n_file not in files_seen else 0
                score = ncc + cross_file_bonus
                if score > best_score:
                    best_next = neighbor
                    best_score = score
            current = best_next

        if len(chain) < 2 or total_cc < 20:
            continue

        # Deduplicate: skip chains with same core nodes
        core = frozenset(step["id"] for step in chain)
        if core in seen_cores:
            continue
        seen_cores.add(core)

        communities_crossed = len(
            set(s["community"] for s in chain if s["community"] is not None)
        )
        files_crossed = len(set(s["file"] for s in chain if s["file"]))

        # Find the "break here" point: highest CC step that isn't
        # the first (splitting the start doesn't break the chain)
        break_idx = 0
        if len(chain) > 1:
            break_idx = max(
                range(len(chain)),
                key=lambda i: chain[i]["cc"],
            )

        chains.append({
            "steps": chain,
            "total_cc": total_cc,
            "communities_crossed": communities_crossed,
            "files_crossed": files_crossed,
            "break_at": break_idx,
        })

    # Sort by: cross-file chains first, then by total CC
    chains.sort(
        key=lambda x: (x["files_crossed"] > 1, x["total_cc"]),
        reverse=True,
    )
    return chains[:top_n]


def analyze(src_path):
    """Full cross-reference analysis. Returns combined results dict."""
    # Auto-build an AST-only graph if none exists (self-contained mode)
    ensure_graph_exists(src_path)

    print("Loading graph...")
    nodes, edges = load_graph()

    print("Running radon CC...")
    cc_map, avg_cc = run_radon_cc(src_path)

    print("Running radon MI...")
    mi_map = run_radon_mi(src_path)

    print("Running radon raw...")
    loc_map = run_radon_raw(src_path)

    print("Running ruff...")
    ruff_map, total_ruff = run_ruff(src_path)

    # Annotate nodes with metrics and compute risk
    print("Computing risk scores...")
    risk_scores = []
    for nid, node in nodes.items():
        cc, mi, loc = match_node_to_file(node, cc_map, mi_map, loc_map)
        degree = node["degree"]
        risk = compute_risk(degree, cc, mi)
        node["cc"] = cc
        node["mi"] = mi
        node["loc"] = loc
        node["risk"] = risk
        if risk > 0:
            risk_scores.append({
                "id": nid,
                "label": node["label"][:80],
                "file": node["source_file"],
                "degree": degree,
                "cc": cc,
                "mi": mi,
                "loc": loc,
                "risk": risk,
                "community": node.get("community"),
            })

    risk_scores.sort(key=lambda x: x["risk"], reverse=True)

    # Community health
    print("Scoring community health...")
    community_health = compute_community_health(
        nodes, cc_map, mi_map, loc_map,
    )

    # Contagion chains
    print("Tracing complexity contagion...")
    chains = find_contagion_chains(nodes, edges, cc_map, mi_map)

    # Clean Architecture metrics (SDP, SAP, ADP)
    print("Computing architecture metrics (SDP/SAP/ADP)...")
    arch_metrics, cycles = compute_architecture_metrics(nodes, edges)

    results = {
        "summary": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "total_files": len(loc_map),
            "total_loc": sum(loc_map.values()),
            "avg_cc": round(avg_cc, 1),
            "total_ruff": total_ruff,
            "communities": len(
                set(n.get("community") for n in nodes.values() if n.get("community"))
            ),
        },
        "top_risks": risk_scores[:25],
        "community_health": {
            str(k): v for k, v in sorted(
                community_health.items(),
                key=lambda x: x[1]["avg_cc"],
                reverse=True,
            )
        },
        "contagion_chains": chains,
        "architecture_metrics": {str(k): v for k, v in arch_metrics.items()},
        "cycles": cycles,
        "cc_map_size": len(cc_map),
        "mi_map_size": len(mi_map),
    }

    out = Path("code-health-out")
    out.mkdir(exist_ok=True)
    (out / "crossref.json").write_text(json.dumps(results, indent=2))
    print(f"\nCross-reference complete. Results: code-health-out/crossref.json")
    return results


def generate_html(results=None):
    """Generate the combined HTML dashboard."""
    if results is None:
        data_path = Path("code-health-out/crossref.json")
        if not data_path.exists():
            print("No crossref.json found. Run analyze first.")
            sys.exit(1)
        results = json.loads(data_path.read_text())

    s = results["summary"]
    top = results["top_risks"]
    comm = results["community_health"]
    chains = results["contagion_chains"]

    # Determine overall health score (0-10)
    avg_cc = s.get("avg_cc", 5)
    if top:
        max_risk = top[0]["risk"]
        critical_count = sum(1 for r in top if r["risk"] > 100)
    else:
        max_risk = 0
        critical_count = 0

    cc_score = max(10 - avg_cc * 0.5, 0)
    risk_penalty = min(critical_count * 0.4, 4)
    health_score = round(max(cc_score - risk_penalty, 0), 1)

    if health_score >= 8:
        score_color = "#10b981"
    elif health_score >= 5:
        score_color = "#f59e0b"
    else:
        score_color = "#f43f5e"

    # Score ring offset (circumference = 427.3, offset = circ * (1 - score/10))
    ring_offset = round(427.3 * (1 - health_score / 10), 1)

    # Build neighbor data from graph for detail panels
    graph_path = Path("graphify-out/graph.json")
    node_neighbors = {}
    if graph_path.exists():
        gdata = json.loads(graph_path.read_text())
        g_nodes_by_id = {n["id"]: n for n in gdata.get("nodes", [])}
        g_adj = defaultdict(list)
        for link in gdata.get("links", []):
            src, tgt = link.get("source", ""), link.get("target", "")
            rel = link.get("relation", "")
            if src in {r["id"] for r in top[:20]}:
                tl = g_nodes_by_id.get(tgt, {}).get("label", tgt)[:50]
                tc = g_nodes_by_id.get(tgt, {}).get("community", "?")
                g_adj[src].append({"l": tl, "r": rel, "c": tc})
            if tgt in {r["id"] for r in top[:20]}:
                sl = g_nodes_by_id.get(src, {}).get("label", src)[:50]
                sc = g_nodes_by_id.get(src, {}).get("community", "?")
                g_adj[tgt].append({"l": sl, "r": rel, "c": sc})
        node_neighbors = dict(g_adj)

    # Build embedded node data for JS
    node_data_js = {}
    for r in top[:20]:
        cc = r["cc"] or 1
        mi = r["mi"] or 50
        deg = r["degree"]
        log_cc = math.log(cc + 1)
        mi_penalty = (100 - min(mi, 100)) / 100

        # Determine primary problem and suggestion
        problems = []
        if cc >= 20:
            problems.append("Extremely high cyclomatic complexity")
        elif cc >= 8:
            problems.append("High cyclomatic complexity")
        if mi < 30:
            problems.append("Very low maintainability")
        elif mi < 50:
            problems.append("Low maintainability")
        if deg >= 100:
            problems.append("Extremely high connectivity (god node)")
        elif deg >= 30:
            problems.append("High connectivity")

        suggestions = []
        if cc >= 20:
            suggestions.append(
                "Split into smaller functions by extracting logical phases"
            )
        if mi < 40:
            suggestions.append(
                "Reduce nesting depth and simplify conditionals"
            )
        if deg >= 50:
            suggestions.append(
                "Introduce an interface/protocol to decouple consumers"
            )

        neighbors = node_neighbors.get(r["id"], [])
        # Group neighbors by community
        comm_groups = defaultdict(list)
        for n in neighbors[:30]:
            comm_groups[str(n["c"])].append(n["l"])

        node_data_js[r["id"]] = {
            "label": r["label"],
            "file": r["file"],
            "degree": deg,
            "cc": r["cc"],
            "mi": round(mi, 1),
            "loc": r.get("loc"),
            "risk": r["risk"],
            "deg_contrib": round(deg * 0.4, 1),
            "cc_contrib": round(log_cc * 30, 1),
            "mi_contrib": round(mi_penalty * 100, 1),
            "problems": problems,
            "suggestions": suggestions,
            "communities_reached": len(comm_groups),
            "top_neighbors": {
                k: v[:5] for k, v in
                sorted(comm_groups.items(), key=lambda x: -len(x[1]))[:6]
            },
        }

    node_data_json = json.dumps(node_data_js)

    # Build risk table rows (clickable)
    risk_rows = ""
    for i, r in enumerate(top[:20]):
        risk_val = r["risk"]
        if risk_val > 100:
            rcls = "val-critical"
            bar_cls = "bar-critical"
        elif risk_val > 30:
            rcls = "val-warning"
            bar_cls = "bar-warning"
        else:
            rcls = "val-good"
            bar_cls = "bar-good"
        bar_w = min(round(risk_val / (top[0]["risk"] or 1) * 100), 100)
        cc_display = r["cc"] if r["cc"] else "—"
        mi_display = round(r["mi"], 1) if r["mi"] else "—"
        risk_rows += (
            f'<tr class="risk-row" data-node-id="{r["id"]}" '
            f'style="cursor:pointer;">'
            f'<td>{r["label"]}</td>'
            f'<td style="color:var(--text-muted)">{r["file"]}</td>'
            f'<td class="mono">{r["degree"]}</td>'
            f'<td class="mono">{cc_display}</td>'
            f'<td class="mono">{mi_display}</td>'
            f'<td><div class="severity-cell">'
            f'<div class="severity-bar"><div class="severity-bar-fill {bar_cls}" '
            f'style="width:{bar_w}%"></div></div>'
            f'<span class="{rcls}">{risk_val}</span></div></td></tr>\n'
            f'<tr class="detail-row" id="detail-{r["id"]}" style="display:none;">'
            f'<td colspan="6"><div class="detail-panel" id="panel-{r["id"]}"></div></td></tr>\n'
        )

    # Build community data for JS detail panels
    comm_data_js = {}
    for cid, ch in list(comm.items())[:15]:
        comm_data_js[cid] = {
            "sample": ch["sample_nodes"][:5],
            "files": ch["files"],
            "nodes": ch["nodes"],
            "avg_cc": ch["avg_cc"],
            "avg_mi": ch["avg_mi"],
            "loc": ch["loc"],
            "status": ch["status"],
            "file_details": ch.get("file_details", []),
            "recommendations": ch.get("recommendations", []),
        }
    comm_data_json = json.dumps(comm_data_js)

    # Build community health rows (clickable)
    comm_rows = ""
    for cid, ch in list(comm.items())[:15]:
        if ch["status"] == "CRITICAL":
            scls = "val-critical"
        elif ch["status"] == "WARN":
            scls = "val-warning"
        else:
            scls = "val-good"
        sample = ", ".join(ch["sample_nodes"][:3])
        comm_rows += (
            f'<tr class="comm-row" data-comm-id="{cid}" style="cursor:pointer;">'
            f'<td>{sample}</td>'
            f'<td class="mono">{ch["files"]}</td>'
            f'<td class="mono">{ch["avg_cc"]}</td>'
            f'<td class="mono">{ch["avg_mi"]}</td>'
            f'<td class="{scls}">{ch["status"]}</td></tr>\n'
            f'<tr class="comm-detail-row" id="comm-detail-{cid}" style="display:none;">'
            f'<td colspan="5"><div class="detail-panel" id="comm-panel-{cid}"></div></td></tr>\n'
        )

    # Build contagion chain blocks (horizontal flowchart)
    chain_blocks = ""
    for i, chain in enumerate(chains):
        break_at = chain.get("break_at", -1)
        files_crossed = chain.get("files_crossed", 0)
        steps_html = ""
        for j, step in enumerate(chain["steps"]):
            cc = step["cc"] or 0
            # Size the CC badge by severity
            if cc >= 30:
                sz = "cc-xl"
            elif cc >= 15:
                sz = "cc-lg"
            else:
                sz = "cc-sm"
            # Mark the "break here" step
            is_break = j == break_at
            break_cls = " chain-node-break" if is_break else ""
            break_tag = (
                '<span class="break-tag">break here</span>'
                if is_break else ""
            )
            # Arrow between nodes
            arrow = ""
            if j > 0:
                arrow = '<div class="chain-arrow">→</div>'
            # Short file name
            short_file = step["file"].split("/")[-1] if step["file"] else ""
            steps_html += (
                f'{arrow}'
                f'<div class="chain-node{break_cls}">'
                f'<div class="chain-node-cc {sz}">{cc}</div>'
                f'<div class="chain-node-label">{step["label"]}</div>'
                f'<div class="chain-node-file">{short_file}</div>'
                f'{break_tag}'
                f'</div>\n'
            )
        chain_blocks += f"""
        <div class="chain-card">
            <div class="chain-header">
                <span>Chain #{i+1}</span>
                <span class="chain-meta">
                    Total CC: {chain["total_cc"]} &middot;
                    {files_crossed} file{"s" if files_crossed != 1 else ""} &middot;
                    {chain["communities_crossed"]} communit{"ies" if chain["communities_crossed"] != 1 else "y"}
                </span>
            </div>
            <div class="chain-flow">{steps_html}</div>
        </div>"""

    # ── Main Sequence plot (SDP + SAP) ──
    # Get architecture metrics from results (re-compute if needed)
    arch_path = Path("code-health-out/crossref.json")
    if arch_path.exists():
        cross_data = json.loads(arch_path.read_text())
        arch_metrics = cross_data.get("architecture_metrics", {})
        cycles_data = cross_data.get("cycles", [])
    else:
        arch_metrics = {}
        cycles_data = []

    # Build Main Sequence plot data.
    # Note: what our code calls "stability" is actually "instability" in
    # Bob Martin's terminology: I = fan_out / (fan_in + fan_out).
    # I=0 means stable (nothing leaves), I=1 means unstable (everything leaves).
    # Filter: only communities with cross-community edges AND >= 3 nodes.
    ms_dots = ""
    ms_counts = {"on_seq": 0, "pain": 0, "useless": 0, "off": 0}
    ms_dot_data_js = {}
    max_nodes = 1
    for cid, m in arch_metrics.items():
        c_data = comm.get(str(cid)) or comm.get(cid)
        node_count = (c_data or {}).get("nodes", 0)
        if node_count > max_nodes:
            max_nodes = node_count

    for cid, m in arch_metrics.items():
        total_edges = m.get("fan_in", 0) + m.get("fan_out", 0)
        if total_edges == 0:
            continue
        c_data = comm.get(str(cid)) or comm.get(cid)
        node_count = (c_data or {}).get("nodes", 0)
        if node_count < 3:
            continue

        # "stability" in our JSON = Instability in the book
        instab = m.get("stability", 0)
        abstr = m.get("abstraction", 0)
        dist = m.get("distance", 1)

        # Plot coordinates
        left_pct = round(instab * 100, 1)
        bottom_pct = round(abstr * 100, 1)

        # Classify zones per the book diagram
        if dist < 0.2:
            cls = "ms-good"
            ms_counts["on_seq"] += 1
        elif instab < 0.3 and abstr < 0.3:
            cls = "ms-critical"
            ms_counts["pain"] += 1
        elif instab > 0.7 and abstr > 0.7:
            cls = "ms-critical"
            ms_counts["useless"] += 1
        else:
            cls = "ms-warning"
            ms_counts["off"] += 1

        # Size dot by node count (log scale for readability)
        import math as _m
        size = round(8 + _m.log(max(node_count, 1) + 1) * 3, 1)

        # Top file label for the dot
        top_file = ""
        if c_data and c_data.get("file_details"):
            fd = c_data["file_details"][0]
            f_path = fd.get("file", "")
            parts = f_path.split("/")
            top_file = (
                "/".join(parts[-2:]) if len(parts) >= 2
                else (parts[-1] if parts else "")
            )

        ms_dot_data_js[str(cid)] = {
            "label": top_file or f"Community {cid}",
            "instab": instab,
            "abstr": abstr,
            "dist": dist,
            "fan_in": m.get("fan_in", 0),
            "fan_out": m.get("fan_out", 0),
            "nodes": node_count,
        }

        ms_dots += (
            f'<div class="ms-dot {cls}" '
            f'data-cid="{cid}" '
            f'style="left:{left_pct}%;bottom:{bottom_pct}%;'
            f'width:{size}px;height:{size}px;" '
            f'title="{top_file or f"Community {cid}"} | I={instab} A={abstr}"></div>'
        )

    ms_dot_json = json.dumps(ms_dot_data_js)

    # Build cycles HTML with meaningful community names.
    # Strategy: use the TOP file (by CC) as the primary identifier,
    # and list 2 more representative files below.
    def _community_label(cid):
        """Return (primary_file, secondary_files, node_count)."""
        cstr = str(cid)
        c = comm.get(cstr) or comm.get(int(cstr) if cstr.isdigit() else cstr)
        if not c:
            return (f"Community {cid}", [], 0)

        file_details = c.get("file_details", [])
        # file_details is already sorted by CC descending
        files = [f.get("file", "") for f in file_details if f.get("file")]
        node_count = c.get("nodes", 0)

        if not files:
            samples = c.get("sample_nodes", [])
            label = samples[0][:35] if samples else f"Community {cid}"
            return (label, [], node_count)

        # Primary = top CC file, show with its parent dir for context
        top = files[0]
        parts = top.split("/")
        if len(parts) >= 2:
            primary = f"{parts[-2]}/{parts[-1]}"
        else:
            primary = parts[-1]

        # Secondary files = next 2, basename only
        secondary = [f.split("/")[-1] for f in files[1:3]]

        return (primary, secondary, node_count)

    cycles_html = ""
    if cycles_data:
        # Only show unique, shortest cycles (2-3 hops are clearest)
        shown_cores = set()
        unique_cycles = []
        for cycle in sorted(cycles_data, key=len):
            core = frozenset(cycle)
            if core in shown_cores:
                continue
            shown_cores.add(core)
            unique_cycles.append(cycle)
            if len(unique_cycles) >= 5:
                break

        cycles_html = (
            '<div style="font-family:var(--font-sans);font-size:0.82em;'
            'color:var(--text-muted);margin-bottom:12px;line-height:1.5;">'
            f'Found <strong style="color:var(--critical);">{len(cycles_data)}</strong> '
            f'cycles &mdash; showing <strong>{len(unique_cycles)}</strong> shortest unique paths. '
            'Each cycle means: changes to any module in the loop force re-testing of all others.'
            '</div>'
        )

        for idx, cycle in enumerate(unique_cycles):
            # Build visual node chain
            nodes_html = ""
            for i, cid in enumerate(cycle):
                label, basenames, node_count = _community_label(cid)
                files_str = (
                    " &middot; ".join(basenames[:2]) if basenames else ""
                )
                subtitle = (
                    f'<div class="cycle-node-files">{files_str}</div>'
                    if files_str else ""
                )
                count_badge = (
                    f'<div class="cycle-node-count">{node_count} nodes</div>'
                    if node_count else ""
                )
                nodes_html += (
                    f'<div class="cycle-node-box">'
                    f'<div class="cycle-node-title">{label}</div>'
                    f'{subtitle}{count_badge}'
                    f'</div>'
                )
                if i < len(cycle) - 1:
                    nodes_html += '<div class="cycle-arrow-big">→</div>'

            # Close the loop visually
            first_label, _, _ = _community_label(cycle[0])
            nodes_html += '<div class="cycle-arrow-big cycle-loop">↺</div>'
            nodes_html += (
                f'<div class="cycle-node-box cycle-node-ghost">'
                f'<div class="cycle-node-title">{first_label}</div>'
                f'</div>'
            )

            impact = (
                f"A change to any module in this {len(cycle)}-hop loop "
                f"forces re-testing of all others. Break the cycle by "
                f"extracting shared types to a new module, or inverting "
                f"one of the dependencies via an interface."
            )

            cycles_html += f"""
            <div class="cycle-card-v2">
                <div class="cycle-header">
                    <span class="cycle-title">Cycle #{idx + 1}</span>
                    <span class="cycle-length">{len(cycle)}-hop loop</span>
                </div>
                <div class="cycle-flow">{nodes_html}</div>
                <div class="cycle-impact">{impact}</div>
            </div>"""
    else:
        cycles_html = (
            '<div style="color:var(--good);text-align:center;padding:20px;'
            'font-family:var(--font-mono);font-size:0.85em;">'
            'No circular dependencies detected</div>'
        )

    # Knowledge graph embed
    graphify_path = Path("graphify-out/graph.html")
    if graphify_path.exists():
        graph_rel = "../graphify-out/graph.html"
        graph_section = (
            f'<div class="graph-embed">'
            f'<iframe src="{graph_rel}" title="Knowledge Graph"></iframe>'
            f'</div>'
            f'<div style="text-align:center;margin-top:8px;">'
            f'<a href="{graph_rel}" target="_blank" '
            f'style="font-family:var(--font-mono);font-size:0.78em;'
            f'color:var(--accent-blue);text-decoration:none;">'
            f'Open full-screen &rarr;</a></div>'
        )
    else:
        graph_section = (
            '<div style="color:var(--text-muted);text-align:center;'
            'padding:40px;font-style:italic;border:1px dashed var(--border-light);'
            'border-radius:10px;">'
            'No graph found. Run /graphify to build the knowledge graph.</div>'
        )

    # Critical counts for summary cards
    critical_risk = sum(1 for r in top if r["risk"] > 100)
    high_risk = sum(1 for r in top if 30 < r["risk"] <= 100)
    unhealthy_comms = sum(
        1 for ch in comm.values() if ch["status"] == "CRITICAL"
    )
    total_chains = len(chains)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Code Health Report</title>
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {{
    --bg-primary: #0a0e17;
    --bg-secondary: #111827;
    --bg-card: #151d2e;
    --bg-card-hover: #1a2540;
    --border: #1e293b;
    --border-light: #253247;
    --text-primary: #e2e8f0;
    --text-secondary: #94a3b8;
    --text-muted: #64748b;
    --accent-blue: #3b82f6;
    --accent-cyan: #22d3ee;
    --critical: #f43f5e;
    --critical-bg: rgba(244,63,94,0.08);
    --warning: #f59e0b;
    --warning-bg: rgba(245,158,11,0.08);
    --good: #10b981;
    --good-bg: rgba(16,185,129,0.08);
    --font-mono: 'JetBrains Mono', monospace;
    --font-sans: 'Outfit', system-ui, sans-serif;
}}
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{ font-family: var(--font-sans); background: var(--bg-primary); color: var(--text-primary); }}
body::before {{
    content: ''; position: fixed; inset: 0; opacity: 0.02;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
    pointer-events: none; z-index: 1000;
}}
.dash {{ max-width: 1440px; margin: 0 auto; padding: 40px 32px; }}
.header {{ display: flex; align-items: flex-end; justify-content: space-between; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 1px solid var(--border); }}
.header-title {{ font-family: var(--font-mono); font-size: 1.5em; font-weight: 600; }}
.header-title span {{ color: var(--accent-cyan); }}
.header-meta {{ font-family: var(--font-mono); font-size: 0.8em; color: var(--text-muted); text-align: right; }}
.header-meta strong {{ color: var(--text-secondary); font-weight: 500; }}

.score-section {{ display: flex; align-items: center; gap: 48px; margin-bottom: 40px; padding: 32px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; }}
.score-ring-c {{ position: relative; width: 160px; height: 160px; flex-shrink: 0; }}
.score-ring {{ width: 100%; height: 100%; transform: rotate(-90deg); }}
.score-ring-bg {{ fill: none; stroke: var(--border-light); stroke-width: 8; }}
.score-ring-fill {{ fill: none; stroke-width: 8; stroke-linecap: round; }}
.score-val {{ position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }}
.score-num {{ font-family: var(--font-mono); font-size: 2.8em; font-weight: 700; line-height: 1; }}
.score-lbl {{ font-size: 0.75em; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px; }}
.score-stats {{ flex: 1; display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }}
.ss-val {{ font-family: var(--font-mono); font-size: 1.8em; font-weight: 600; text-align: center; }}
.ss-lbl {{ font-size: 0.78em; color: var(--text-muted); text-align: center; margin-top: 2px; }}

.cards {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 40px; }}
.card {{ background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 20px; position: relative; overflow: visible; }}
.card::before {{ content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; border-radius: 10px 10px 0 0; }}
.card.c-crit::before {{ background: var(--critical); }}
.card.c-warn::before {{ background: var(--warning); }}
.card.c-good::before {{ background: var(--good); }}
.card-title {{ font-size: 0.72em; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 12px; }}
.card-val {{ font-family: var(--font-mono); font-size: 2.2em; font-weight: 700; line-height: 1; }}
.card-desc {{ font-size: 0.78em; color: var(--text-muted); margin-top: 6px; }}
.val-critical {{ color: var(--critical); }}
.val-warning {{ color: var(--warning); }}
.val-good {{ color: var(--good); }}

.sh {{ display: flex; align-items: center; gap: 12px; margin: 40px 0 16px; padding-bottom: 12px; border-bottom: 1px solid var(--border); }}
.sh h2 {{ font-family: var(--font-mono); font-size: 0.95em; font-weight: 500; color: var(--text-secondary); }}
.sh .badge {{ font-family: var(--font-mono); font-size: 0.7em; padding: 2px 8px; border-radius: 4px; background: var(--bg-card); border: 1px solid var(--border); color: var(--text-muted); }}

table {{ width: 100%; border-collapse: separate; border-spacing: 0; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }}
thead th {{ font-family: var(--font-mono); font-size: 0.72em; font-weight: 500; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; padding: 14px 16px; background: var(--bg-secondary); border-bottom: 1px solid var(--border); text-align: left; }}
thead th:last-child {{ text-align: right; }}
tbody td {{ font-size: 0.85em; padding: 10px 16px; border-bottom: 1px solid rgba(30,41,59,0.5); color: var(--text-secondary); }}
tbody td:first-child {{ color: var(--text-primary); font-weight: 500; }}
tbody tr:last-child td {{ border-bottom: none; }}
tbody tr:hover td {{ background: rgba(59,130,246,0.03); }}
.mono {{ font-family: var(--font-mono); font-size: 0.85em; text-align: center; }}

.severity-cell {{ display: flex; align-items: center; justify-content: flex-end; gap: 10px; }}
.severity-bar {{ width: 60px; height: 4px; border-radius: 2px; background: var(--border-light); overflow: hidden; }}
.severity-bar-fill {{ height: 100%; border-radius: 2px; }}
.bar-critical {{ background: var(--critical); }}
.bar-warning {{ background: var(--warning); }}
.bar-good {{ background: var(--good); }}

.chain-card {{ background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 20px; margin-bottom: 12px; }}
.chain-header {{ display: flex; justify-content: space-between; margin-bottom: 16px; font-family: var(--font-mono); font-size: 0.85em; color: var(--text-secondary); }}
.chain-meta {{ color: var(--text-muted); }}
.chain-flow {{ display: flex; align-items: center; gap: 0; overflow-x: auto; padding: 8px 0; }}
.chain-arrow {{ font-size: 1.4em; color: var(--text-muted); padding: 0 12px; flex-shrink: 0; }}
.chain-node {{ background: var(--bg-secondary); border: 1px solid var(--border-light); border-radius: 8px; padding: 14px 16px; min-width: 140px; text-align: center; position: relative; flex-shrink: 0; transition: border-color 0.2s; }}
.chain-node:hover {{ border-color: var(--accent-cyan); }}
.chain-node-break {{ border-color: var(--critical); border-style: dashed; }}
.chain-node-cc {{ font-family: var(--font-mono); font-weight: 700; margin-bottom: 6px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; }}
.cc-xl {{ font-size: 1.6em; width: 52px; height: 52px; background: var(--critical-bg); color: var(--critical); border: 2px solid var(--critical); }}
.cc-lg {{ font-size: 1.3em; width: 44px; height: 44px; background: var(--warning-bg); color: var(--warning); border: 2px solid var(--warning); }}
.cc-sm {{ font-size: 1.1em; width: 36px; height: 36px; background: rgba(34,211,238,0.08); color: var(--accent-cyan); border: 2px solid rgba(34,211,238,0.3); }}
.chain-node-label {{ font-family: var(--font-mono); font-size: 0.78em; color: var(--text-primary); font-weight: 500; margin-top: 6px; word-break: break-word; }}
.chain-node-file {{ font-family: var(--font-mono); font-size: 0.68em; color: var(--text-muted); margin-top: 2px; }}
.break-tag {{ position: absolute; top: -10px; right: -8px; font-family: var(--font-mono); font-size: 0.6em; padding: 2px 6px; border-radius: 4px; background: var(--critical); color: white; font-weight: 600; white-space: nowrap; }}

.sh-icon {{ width: 20px; height: 20px; stroke: var(--accent-cyan); fill: none; stroke-width: 1.8; flex-shrink: 0; }}
.card-icon {{ width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 1.8; margin-bottom: 8px; opacity: 0.6; }}

/* ── Tooltip (info icon with hover popup) ── */
.tip {{ position: relative; display: inline-flex; align-items: center; justify-content: center; cursor: help; }}
.tip-icon {{ width: 16px; height: 16px; stroke: var(--text-muted); fill: none; stroke-width: 2; transition: stroke 0.2s; }}
.tip:hover .tip-icon {{ stroke: var(--accent-cyan); }}
.tip-text {{
    visibility: hidden; opacity: 0;
    position: absolute; bottom: calc(100% + 10px); left: 50%; transform: translateX(-50%);
    background: #1e293b; color: var(--text-secondary); border: 1px solid var(--border-light);
    border-radius: 8px; padding: 10px 14px; font-family: var(--font-sans); font-size: 0.78em;
    line-height: 1.5; width: max-content; max-width: 300px; z-index: 9999;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    transition: opacity 0.2s, visibility 0.2s;
    pointer-events: none;
}}
.tip-text::after {{
    content: ''; position: absolute; top: 100%; left: 50%; transform: translateX(-50%);
    border: 6px solid transparent; border-top-color: #1e293b;
}}
.tip:hover .tip-text {{ visibility: visible; opacity: 1; }}
/* Right-align tooltips near right edge */
.tip-right .tip-text {{ left: auto; right: 0; transform: none; }}
.tip-right .tip-text::after {{ left: auto; right: 16px; transform: none; }}

.two-col {{ display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }}

.graph-embed {{ border-radius: 10px; overflow: hidden; border: 1px solid var(--border); background: #fff; }}
.graph-embed iframe {{ width: 100%; height: 600px; border: none; display: block; }}

/* ── Detail Panel (expandable row) ── */
.risk-row:hover td, .comm-row:hover td {{ background: rgba(59,130,246,0.06); }}
.risk-row td:first-child::before, .comm-row td:first-child::before {{ content: ''; display: inline-block; width: 0; height: 0; border-left: 5px solid var(--text-muted); border-top: 4px solid transparent; border-bottom: 4px solid transparent; margin-right: 8px; transition: transform 0.2s; }}
.risk-row.expanded td:first-child::before, .comm-row.expanded td:first-child::before {{ transform: rotate(90deg); }}
.detail-row td, .comm-detail-row td {{ padding: 0 !important; border-bottom: 1px solid var(--border) !important; }}
.detail-panel {{
    padding: 24px; background: var(--bg-secondary); border-top: 1px solid var(--border);
    animation: slideDown 0.25s ease-out;
}}
@keyframes slideDown {{ from {{ opacity: 0; max-height: 0; }} to {{ opacity: 1; max-height: 600px; }} }}
.dp-grid {{ display: grid; grid-template-columns: 280px 1fr; gap: 24px; }}
.dp-section-title {{ font-family: var(--font-mono); font-size: 0.72em; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 12px; }}
.dp-bar-row {{ display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }}
.dp-bar-label {{ font-family: var(--font-mono); font-size: 0.78em; color: var(--text-secondary); width: 90px; flex-shrink: 0; }}
.dp-bar {{ flex: 1; height: 20px; border-radius: 4px; background: var(--border-light); overflow: hidden; }}
.dp-bar-fill {{ height: 100%; border-radius: 4px; transition: width 0.6s ease-out; }}
.dp-bar-val {{ font-family: var(--font-mono); font-size: 0.78em; font-weight: 600; width: 50px; text-align: right; flex-shrink: 0; }}
.dp-problems {{ list-style: none; padding: 0; margin: 0 0 16px; }}
.dp-problems li {{ font-size: 0.85em; color: var(--critical); padding: 4px 0; }}
.dp-problems li::before {{ content: '!'; display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: var(--critical-bg); font-family: var(--font-mono); font-size: 0.7em; font-weight: 700; margin-right: 8px; }}
.dp-suggestions {{ list-style: none; padding: 0; margin: 0; }}
.dp-suggestions li {{ font-size: 0.85em; color: var(--good); padding: 4px 0; }}
.dp-suggestions li::before {{ content: '>'; display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px; border-radius: 50%; background: var(--good-bg); font-family: var(--font-mono); font-size: 0.7em; font-weight: 700; margin-right: 8px; }}
.dp-neighbors {{ display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }}
.dp-neighbor-tag {{ font-family: var(--font-mono); font-size: 0.72em; padding: 3px 8px; border-radius: 4px; background: var(--bg-card); border: 1px solid var(--border); color: var(--text-secondary); }}
.dp-comm-label {{ font-family: var(--font-mono); font-size: 0.7em; color: var(--text-muted); margin-top: 12px; margin-bottom: 4px; }}

/* ── Main Sequence plot (SDP + SAP, per Robert C. Martin) ── */
.ms-container {{ display: grid; grid-template-columns: 1fr 300px; gap: 32px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 28px 28px 40px; margin-bottom: 12px; }}
.ms-plot {{ position: relative; aspect-ratio: 1/1; max-width: 500px; margin-left: 28px; background: #0d1420; border: 1px solid var(--border-light); border-radius: 6px; }}
.ms-grid {{ position: absolute; inset: 0; background-image:
    linear-gradient(to right, rgba(30,41,59,0.35) 1px, transparent 1px),
    linear-gradient(to top, rgba(30,41,59,0.35) 1px, transparent 1px);
    background-size: 10% 10%; pointer-events: none; }}
.ms-diagonal {{ position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }}
.ms-zone {{ position: absolute; padding: 10px 14px; border-radius: 6px; pointer-events: none; font-family: var(--font-sans); z-index: 2; }}
.ms-zone-title {{ font-size: 0.78em; font-weight: 600; letter-spacing: 0.02em; }}
.ms-zone-desc {{ font-size: 0.68em; opacity: 0.75; margin-top: 2px; font-family: var(--font-mono); }}
.ms-zone-pain {{ bottom: 14px; left: 14px; background: rgba(244,63,94,0.12); color: var(--critical); border: 1px solid rgba(244,63,94,0.3); }}
.ms-zone-useless {{ top: 14px; right: 14px; background: rgba(245,158,11,0.12); color: var(--warning); border: 1px solid rgba(245,158,11,0.3); }}
.ms-corner-label {{ position: absolute; font-family: var(--font-mono); font-size: 0.65em; color: var(--text-muted); }}
.ms-corner-00 {{ bottom: -20px; left: -4px; }}
.ms-corner-10 {{ bottom: -20px; right: -4px; }}
.ms-corner-01 {{ top: -4px; left: -32px; }}
.ms-corner-11 {{ top: -4px; right: -4px; }}
.ms-axis-x-label {{ text-align: center; margin-top: 28px; margin-left: 28px; max-width: 500px; font-family: var(--font-mono); font-size: 0.75em; color: var(--text-muted); }}
.ms-axis-y-label {{ position: absolute; left: 4px; top: 50%; transform: translateY(-50%) rotate(-90deg); transform-origin: center; white-space: nowrap; font-family: var(--font-mono); font-size: 0.75em; color: var(--text-muted); }}
.ms-dot {{ position: absolute; border-radius: 50%; transform: translate(-50%, 50%); cursor: pointer; transition: transform 0.15s, box-shadow 0.15s, filter 0.15s; z-index: 5; }}
.ms-dot:hover {{ transform: translate(-50%, 50%) scale(1.3); box-shadow: 0 0 16px currentColor; z-index: 10; filter: brightness(1.3); }}
.ms-dot.selected {{ box-shadow: 0 0 0 3px var(--accent-cyan), 0 0 16px currentColor; }}
.ms-dot.ms-good {{ background: var(--good); color: var(--good); border: 1px solid rgba(16,185,129,0.9); }}
.ms-dot.ms-warning {{ background: var(--warning); color: var(--warning); border: 1px solid rgba(245,158,11,0.9); }}
.ms-dot.ms-critical {{ background: var(--critical); color: var(--critical); border: 1px solid rgba(244,63,94,0.9); }}

.ms-legend {{ display: flex; flex-direction: column; gap: 20px; font-size: 0.85em; }}
.ms-summary-grid {{ display: grid; gap: 10px; padding-bottom: 16px; border-bottom: 1px solid var(--border); }}
.ms-summary-item {{ display: flex; align-items: center; gap: 10px; color: var(--text-secondary); font-size: 0.88em; }}
.ms-summary-item strong {{ color: var(--text-primary); font-family: var(--font-mono); font-size: 1.1em; }}
.ms-swatch {{ width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }}
.ms-drilldown {{ padding: 14px; background: var(--bg-secondary); border-radius: 8px; min-height: 80px; }}
.ms-drilldown-header {{ font-family: var(--font-mono); font-size: 0.7em; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }}
.ms-drilldown-empty {{ color: var(--text-muted); font-style: italic; font-size: 0.82em; }}
.ms-drilldown-body {{ font-family: var(--font-mono); font-size: 0.78em; color: var(--text-secondary); line-height: 1.7; }}
.ms-drilldown-body .md-label {{ color: var(--text-primary); font-weight: 600; font-size: 1.1em; display: block; margin-bottom: 6px; word-break: break-word; }}
.ms-drilldown-body .md-row {{ display: flex; justify-content: space-between; padding: 2px 0; }}
.ms-drilldown-body .md-key {{ color: var(--text-muted); }}
.ms-formulas {{ display: flex; flex-direction: column; gap: 12px; font-family: var(--font-mono); font-size: 0.75em; color: var(--text-muted); padding-top: 16px; border-top: 1px solid var(--border); }}
.ms-formulas div {{ line-height: 1.5; }}
.ms-formulas strong {{ color: var(--accent-cyan); }}
.ms-formulas em {{ color: var(--text-secondary); font-style: normal; }}

/* ── Cycles (ADP) ── */
.cycle-card-v2 {{ background: var(--bg-card); border: 1px solid var(--border); border-left: 3px solid var(--critical); border-radius: 10px; padding: 18px 22px; margin-bottom: 12px; }}
.cycle-header {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; }}
.cycle-title {{ font-family: var(--font-mono); font-size: 0.82em; color: var(--text-secondary); font-weight: 500; }}
.cycle-length {{ font-family: var(--font-mono); font-size: 0.72em; color: var(--critical); background: var(--critical-bg); padding: 3px 10px; border-radius: 4px; }}
.cycle-flow {{ display: flex; align-items: center; gap: 0; overflow-x: auto; padding: 4px 0 12px; }}
.cycle-node-box {{ flex-shrink: 0; min-width: 160px; padding: 12px 14px; background: var(--bg-secondary); border: 1px solid var(--border-light); border-radius: 8px; text-align: center; }}
.cycle-node-box.cycle-node-ghost {{ opacity: 0.5; border-style: dashed; }}
.cycle-node-title {{ font-family: var(--font-mono); font-size: 0.82em; color: var(--text-primary); font-weight: 500; word-break: break-word; }}
.cycle-node-files {{ font-family: var(--font-mono); font-size: 0.68em; color: var(--text-muted); margin-top: 4px; }}
.cycle-node-count {{ font-family: var(--font-mono); font-size: 0.65em; color: var(--accent-cyan); margin-top: 6px; padding: 2px 6px; background: rgba(34,211,238,0.08); border-radius: 3px; display: inline-block; }}
.cycle-arrow-big {{ color: var(--critical); font-size: 1.6em; padding: 0 14px; flex-shrink: 0; }}
.cycle-arrow-big.cycle-loop {{ color: var(--warning); font-size: 1.8em; }}
.cycle-impact {{ font-size: 0.82em; color: var(--text-muted); padding-top: 12px; border-top: 1px solid var(--border); font-style: italic; }}
.adp-intro {{ font-size: 0.85em; color: var(--text-muted); line-height: 1.6; padding: 14px 18px; background: var(--bg-secondary); border-left: 3px solid var(--accent-cyan); border-radius: 6px; margin-bottom: 16px; }}
.footer {{ margin-top: 48px; padding-top: 20px; border-top: 1px solid var(--border); text-align: center; font-size: 0.75em; color: var(--text-muted); font-family: var(--font-mono); }}

@keyframes fadeUp {{ from {{ opacity: 0; transform: translateY(12px); }} to {{ opacity: 1; transform: translateY(0); }} }}
.a {{ animation: fadeUp 0.5s ease-out both; }}
.d1 {{ animation-delay: .05s; }} .d2 {{ animation-delay: .1s; }} .d3 {{ animation-delay: .15s; }}
.d4 {{ animation-delay: .2s; }} .d5 {{ animation-delay: .25s; }} .d6 {{ animation-delay: .3s; }}

@media (max-width: 1024px) {{ .cards {{ grid-template-columns: repeat(2, 1fr); }} .two-col {{ grid-template-columns: 1fr; }} }}
</style>
</head>
<body>
<div class="dash">

<div class="header a">
    <div>
        <div class="header-title"><span>&gt;</span> code<span>_</span>health</div>
    </div>
    <div class="header-meta">
        <strong>{s["total_files"]}</strong> files &middot;
        <strong>{s["total_loc"]:,}</strong> LOC &middot;
        <strong>{s["total_nodes"]}</strong> graph nodes &middot;
        <strong>{s["communities"]}</strong> communities
    </div>
</div>

<div class="score-section a d1">
    <div class="score-ring-c">
        <svg class="score-ring" viewBox="0 0 160 160">
            <circle class="score-ring-bg" cx="80" cy="80" r="68"/>
            <circle class="score-ring-fill" cx="80" cy="80" r="68"
                stroke="{score_color}" stroke-dasharray="427.3"
                stroke-dashoffset="{ring_offset}"
                style="filter:drop-shadow(0 0 6px {score_color}40);"/>
        </svg>
        <div class="score-val">
            <div class="score-num" style="color:{score_color}">{health_score}</div>
            <div class="score-lbl">health</div>
        </div>
    </div>
    <div class="score-stats">
        <div><div class="ss-val">{s["total_nodes"]:,}</div><div class="ss-lbl">Graph Nodes</div></div>
        <div><div class="ss-val">{s["total_edges"]:,}</div><div class="ss-lbl">Edges</div></div>
        <div><div class="ss-val">{s["avg_cc"]}</div><div class="ss-lbl">Avg CC</div></div>
        <div><div class="ss-val">{s["total_ruff"]}</div><div class="ss-lbl">Lint Issues</div></div>
    </div>
    <div style="text-align:center;">
        <span class="tip"><svg class="tip-icon" viewBox="0 0 24 24" style="width:20px;height:20px;"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg><span class="tip-text">Health score combines complexity (how tangled the logic is), maintainability (how easy to change), and connectivity (how many things break if you touch it). Scale: 0-10. Below 5 = refactoring needed urgently.</span></span>
    </div>
</div>

<div class="cards a d2">
    <div class="card {'c-crit' if critical_risk else 'c-good'}">
        <div style="display:flex;justify-content:space-between;align-items:start;">
            <svg class="card-icon" viewBox="0 0 24 24"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
            <span class="tip"><svg class="tip-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg><span class="tip-text">Nodes with risk score &gt; 100. These are both highly complex AND highly connected — a bug here will propagate widely through the codebase.</span></span>
        </div>
        <div class="card-title">Critical Risk</div>
        <div class="card-val {'val-critical' if critical_risk else 'val-good'}">{critical_risk}</div>
        <div class="card-desc">Nodes with risk &gt; 100</div>
    </div>
    <div class="card {'c-warn' if high_risk else 'c-good'}">
        <div style="display:flex;justify-content:space-between;align-items:start;">
            <svg class="card-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 8v4m0 4h.01"/></svg>
            <span class="tip"><svg class="tip-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg><span class="tip-text">Nodes with risk score 30-100. Moderately dangerous — worth refactoring when you're already working in that area.</span></span>
        </div>
        <div class="card-title">High Risk</div>
        <div class="card-val {'val-warning' if high_risk else 'val-good'}">{high_risk}</div>
        <div class="card-desc">Nodes with risk 30-100</div>
    </div>
    <div class="card {'c-crit' if unhealthy_comms else 'c-good'}">
        <div style="display:flex;justify-content:space-between;align-items:start;">
            <svg class="card-icon" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
            <span class="tip"><svg class="tip-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg><span class="tip-text">Communities (module clusters) where average cyclomatic complexity &gt; 20 or average maintainability index &lt; 30. These areas need the most refactoring attention.</span></span>
        </div>
        <div class="card-title">Unhealthy Communities</div>
        <div class="card-val {'val-critical' if unhealthy_comms else 'val-good'}">{unhealthy_comms}</div>
        <div class="card-desc">Avg CC &gt; 20 or MI &lt; 30</div>
    </div>
    <div class="card {'c-warn' if total_chains else 'c-good'}">
        <div style="display:flex;justify-content:space-between;align-items:start;">
            <svg class="card-icon" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            <span class="tip"><svg class="tip-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg><span class="tip-text">Call chains where complex functions invoke other complex functions. Total chain complexity compounds — a CC=30 calling a CC=40 means 70 effective complexity for anyone debugging the flow.</span></span>
        </div>
        <div class="card-title">Contagion Chains</div>
        <div class="card-val {'val-warning' if total_chains else 'val-good'}">{total_chains}</div>
        <div class="card-desc">Multi-hop complexity paths</div>
    </div>
</div>

<div class="sh a d3">
    <svg class="sh-icon" viewBox="0 0 24 24"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
    <h2>Risk-Weighted Hotspots</h2>
    <span class="tip" style="margin-left:6px;"><svg class="tip-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg><span class="tip-text">Nodes ranked by danger: risk = connections x complexity x (un)maintainability. Edges = how many things touch this node. CC = cyclomatic complexity (branches). MI = maintainability (100=clean, 0=unmaintainable).</span></span>
    <span class="badge">degree x ln(CC+1) x (100-MI)/100</span>
</div>
<table class="a d4">
<thead><tr><th>Node</th><th>File</th><th>Edges</th><th>CC</th><th>MI</th><th style="text-align:right">Risk</th></tr></thead>
<tbody>
{risk_rows}
</tbody>
</table>

<div class="sh a d4">
    <svg class="sh-icon" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
    <h2>Complexity Contagion Chains</h2>
    <span class="tip" style="margin-left:6px;"><svg class="tip-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg><span class="tip-text">When a complex function calls another complex function, debugging becomes exponentially harder. These chains show where complexity compounds through call paths. Break the chain by simplifying the highest-CC step.</span></span>
    <span class="badge">call-graph traversal</span>
</div>
{chain_blocks if chain_blocks else '<div style="color:var(--text-muted);text-align:center;padding:24px;font-style:italic;">No significant contagion chains detected</div>'}

<div class="sh a d5">
    <svg class="sh-icon" viewBox="0 0 24 24"><path d="M3 3v18h18"/><line x1="21" y1="3" x2="3" y2="21" stroke-dasharray="3,3"/><circle cx="7" cy="17" r="1.5"/><circle cx="13" cy="11" r="1.5"/><circle cx="17" cy="7" r="1.5"/></svg>
    <h2>Distance from the Main Sequence (SDP + SAP)</h2>
    <span class="tip" style="margin-left:6px;"><svg class="tip-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg><span class="tip-text">Robert C. Martin's package design metric. Each dot is a community plotted by its Instability (I = fan_out / total) and Abstractness (A = abstract / total classes). The diagonal from (0,1) to (1,0) is the "Main Sequence" — the ideal design line. Dots in the bottom-left (Zone of Pain) are concrete and many things depend on them — rigid and painful to change. Dots in the top-right (Zone of Uselessness) are abstract but nobody depends on them — they serve no purpose. Dot size = community node count.</span></span>
    <span class="badge">D = |A + I - 1|</span>
</div>
<div class="ms-container a d6">
    <div>
        <div class="ms-plot">
            <!-- Grid lines -->
            <div class="ms-grid"></div>
            <!-- Main sequence diagonal line from (0,1) top-left to (1,0) bottom-right -->
            <svg class="ms-diagonal" viewBox="0 0 100 100" preserveAspectRatio="none">
                <line x1="0" y1="0" x2="100" y2="100" stroke="var(--accent-cyan)" stroke-width="0.6" stroke-dasharray="2,2" opacity="0.5"/>
                <text x="50" y="46" fill="var(--accent-cyan)" font-size="3.5" text-anchor="middle" transform="rotate(45 50 50)" opacity="0.8" font-family="monospace">The Main Sequence</text>
            </svg>
            <!-- Zone of Pain: bottom-left -->
            <div class="ms-zone ms-zone-pain">
                <div class="ms-zone-title">Zone of Pain</div>
                <div class="ms-zone-desc">stable + concrete</div>
            </div>
            <!-- Zone of Uselessness: top-right -->
            <div class="ms-zone ms-zone-useless">
                <div class="ms-zone-title">Zone of Uselessness</div>
                <div class="ms-zone-desc">abstract + unused</div>
            </div>
            <!-- Dots -->
            {ms_dots}
            <!-- Axis markers -->
            <div class="ms-corner-label ms-corner-00">(0,0)</div>
            <div class="ms-corner-label ms-corner-10">(1,0)</div>
            <div class="ms-corner-label ms-corner-01">(0,1)</div>
            <div class="ms-corner-label ms-corner-11">(1,1)</div>
        </div>
        <div class="ms-axis-x-label">Instability (I) &rarr; &mdash; fan_out / (fan_in + fan_out)</div>
        <div class="ms-axis-y-label">&larr; Abstractness (A)</div>
    </div>
    <div class="ms-legend">
        <div class="ms-summary-grid">
            <div class="ms-summary-item">
                <span class="ms-swatch" style="background:var(--good)"></span>
                <span><strong>{ms_counts['on_seq']}</strong> on Main Sequence</span>
            </div>
            <div class="ms-summary-item">
                <span class="ms-swatch" style="background:var(--warning)"></span>
                <span><strong>{ms_counts['off']}</strong> off sequence</span>
            </div>
            <div class="ms-summary-item">
                <span class="ms-swatch" style="background:var(--critical)"></span>
                <span><strong>{ms_counts['pain']}</strong> in Zone of Pain</span>
            </div>
            <div class="ms-summary-item">
                <span class="ms-swatch" style="background:var(--critical)"></span>
                <span><strong>{ms_counts['useless']}</strong> in Zone of Uselessness</span>
            </div>
        </div>

        <div class="ms-drilldown" id="ms-drilldown">
            <div class="ms-drilldown-header">Click any dot</div>
            <div class="ms-drilldown-empty">Hover for quick info, click to pin details</div>
        </div>

        <div class="ms-formulas">
            <div><strong>I</strong> = fan_out / (fan_in + fan_out)<br><em>0 = stable, 1 = unstable</em></div>
            <div><strong>A</strong> = abstract / total classes<br><em>0 = concrete, 1 = abstract</em></div>
            <div><strong>D</strong> = |A + I &minus; 1|<br><em>0 = on sequence, 1 = far from it</em></div>
        </div>
    </div>
</div>

<div class="sh a d5">
    <svg class="sh-icon" viewBox="0 0 24 24"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 11-.57-8.38"/></svg>
    <h2>Circular Dependencies (ADP violations)</h2>
    <span class="tip" style="margin-left:6px;"><svg class="tip-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg><span class="tip-text">The Acyclic Dependencies Principle: no community should depend on another that (directly or transitively) depends back on it. Cycles mean you cannot change one without risk to the others — they must be refactored together.</span></span>
    <span class="badge">{len(cycles_data)} cycles found</span>
</div>
<div class="adp-intro a d6">
    When module A depends on B and B depends (directly or transitively) back on A, they form a cycle. This means you cannot change one without risk of breaking the other. Each cycle below shows representative files from the modules involved.
</div>
<div class="a d6">{cycles_html}</div>

<div class="sh a d5">
    <svg class="sh-icon" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
    <h2>Community Health</h2>
    <span class="tip" style="margin-left:6px;"><svg class="tip-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg><span class="tip-text">The knowledge graph groups your code into communities (clusters of tightly connected modules). This table shows each community's average complexity and maintainability. CRITICAL communities are where refactoring effort should focus.</span></span>
    <span class="badge">{len(comm)} communities</span>
</div>
<table class="a d6">
<thead><tr><th>Community (sample nodes)</th><th>Files</th><th>Avg CC</th><th>Avg MI</th><th>Status</th></tr></thead>
<tbody>
{comm_rows}
</tbody>
</table>

<div class="sh a d6">
    <svg class="sh-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4M4.22 4.22l2.83 2.83m9.9 9.9l2.83 2.83M1 12h4m14 0h4M4.22 19.78l2.83-2.83m9.9-9.9l2.83-2.83"/></svg>
    <h2>Knowledge Graph</h2>
    <span class="tip" style="margin-left:6px;"><svg class="tip-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg><span class="tip-text">Interactive visualization of your codebase structure. Nodes are functions, classes, and modules. Edges show imports, calls, and data sharing. Colors represent communities (clusters of related code). Click and drag to explore.</span></span>
</div>
{graph_section}

<div class="footer">
    generated by /code-health &mdash; graphify + radon + ruff + cross-reference engine
</div>

</div>

<script>
const ND = {node_data_json};

function renderPanel(nodeId) {{
    const d = ND[nodeId];
    if (!d) return '';

    const maxBar = Math.max(d.deg_contrib, d.cc_contrib, d.mi_contrib, 1);
    const degW = Math.round(d.deg_contrib / maxBar * 100);
    const ccW = Math.round(d.cc_contrib / maxBar * 100);
    const miW = Math.round(d.mi_contrib / maxBar * 100);

    let problemsHtml = d.problems.map(p => '<li>' + p + '</li>').join('');
    let suggestHtml = d.suggestions.map(s => '<li>' + s + '</li>').join('');

    let neighborsHtml = '';
    for (const [comm, names] of Object.entries(d.top_neighbors)) {{
        neighborsHtml += '<div class="dp-comm-label">Community ' + comm + '</div>';
        neighborsHtml += '<div class="dp-neighbors">';
        for (const n of names) {{
            neighborsHtml += '<span class="dp-neighbor-tag">' + n + '</span>';
        }}
        neighborsHtml += '</div>';
    }}

    return `
    <div class="dp-grid">
        <div>
            <div class="dp-section-title">Risk Breakdown</div>
            <div class="dp-bar-row">
                <span class="dp-bar-label">Edges</span>
                <div class="dp-bar"><div class="dp-bar-fill bar-warning" style="width:${{degW}}%"></div></div>
                <span class="dp-bar-val" style="color:var(--warning)">${{d.degree}}</span>
            </div>
            <div class="dp-bar-row">
                <span class="dp-bar-label">Complexity</span>
                <div class="dp-bar"><div class="dp-bar-fill bar-critical" style="width:${{ccW}}%"></div></div>
                <span class="dp-bar-val" style="color:var(--critical)">${{d.cc || '—'}}</span>
            </div>
            <div class="dp-bar-row">
                <span class="dp-bar-label">MI penalty</span>
                <div class="dp-bar"><div class="dp-bar-fill" style="width:${{miW}}%;background:var(--accent-cyan)"></div></div>
                <span class="dp-bar-val" style="color:var(--accent-cyan)">${{d.mi}}</span>
            </div>
            <div style="margin-top:16px;">
                <div class="dp-section-title">Issues</div>
                <ul class="dp-problems">${{problemsHtml || '<li style="color:var(--text-muted)">No major issues</li>'}}</ul>
                <div class="dp-section-title">Suggestions</div>
                <ul class="dp-suggestions">${{suggestHtml || '<li style="color:var(--text-muted)">No action needed</li>'}}</ul>
            </div>
        </div>
        <div>
            <div class="dp-section-title">Connections (${{d.communities_reached}} communities)</div>
            ${{neighborsHtml || '<div style="color:var(--text-muted);font-style:italic;">No neighbor data available</div>'}}
        </div>
    </div>`;
}}

document.querySelectorAll('.risk-row').forEach(row => {{
    row.addEventListener('click', () => {{
        const nodeId = row.dataset.nodeId;
        const detailRow = document.getElementById('detail-' + nodeId);
        const panel = document.getElementById('panel-' + nodeId);
        const isOpen = detailRow.style.display !== 'none';

        document.querySelectorAll('.detail-row').forEach(r => r.style.display = 'none');
        document.querySelectorAll('.risk-row').forEach(r => r.classList.remove('expanded'));

        if (!isOpen) {{
            if (!panel.innerHTML) panel.innerHTML = renderPanel(nodeId);
            detailRow.style.display = 'table-row';
            row.classList.add('expanded');
        }}
    }});
}});

// ── Community Health detail panels ──
const CD = {comm_data_json};

function renderCommPanel(commId) {{
    const d = CD[commId];
    if (!d) return '';

    // File details table
    let filesHtml = '';
    if (d.file_details && d.file_details.length) {{
        filesHtml = '<table style="width:100%;margin:0;border:none;background:transparent;">' +
            '<thead><tr><th style="background:transparent;border-bottom:1px solid var(--border);padding:6px 8px;">File</th>' +
            '<th style="background:transparent;border-bottom:1px solid var(--border);padding:6px 8px;text-align:center;">CC</th>' +
            '<th style="background:transparent;border-bottom:1px solid var(--border);padding:6px 8px;text-align:center;">MI</th>' +
            '<th style="background:transparent;border-bottom:1px solid var(--border);padding:6px 8px;text-align:center;">LOC</th></tr></thead><tbody>';
        for (const f of d.file_details) {{
            const ccCls = (f.cc || 0) >= 20 ? 'val-critical' : (f.cc || 0) >= 8 ? 'val-warning' : 'val-good';
            const miCls = (f.mi || 100) < 40 ? 'val-critical' : (f.mi || 100) < 65 ? 'val-warning' : 'val-good';
            const shortFile = f.file ? f.file.split('/').slice(-2).join('/') : '—';
            filesHtml += `<tr>` +
                `<td style="border-bottom:1px solid rgba(30,41,59,0.3);padding:5px 8px;font-family:var(--font-mono);font-size:0.8em;">${{shortFile}}</td>` +
                `<td class="${{ccCls}}" style="border-bottom:1px solid rgba(30,41,59,0.3);padding:5px 8px;text-align:center;font-family:var(--font-mono);font-size:0.8em;">${{f.cc || '—'}}</td>` +
                `<td class="${{miCls}}" style="border-bottom:1px solid rgba(30,41,59,0.3);padding:5px 8px;text-align:center;font-family:var(--font-mono);font-size:0.8em;">${{f.mi || '—'}}</td>` +
                `<td style="border-bottom:1px solid rgba(30,41,59,0.3);padding:5px 8px;text-align:center;font-family:var(--font-mono);font-size:0.8em;">${{f.loc || '—'}}</td></tr>`;
        }}
        filesHtml += '</tbody></table>';
    }}

    // Health bar (visual: CC vs MI)
    const ccBar = Math.min(Math.round(d.avg_cc / 30 * 100), 100);
    const miBar = Math.min(Math.round(d.avg_mi), 100);
    const ccBarCls = d.avg_cc > 20 ? 'bar-critical' : d.avg_cc > 8 ? 'bar-warning' : 'bar-good';
    const miBarCls = d.avg_mi < 40 ? 'bar-critical' : d.avg_mi < 65 ? 'bar-warning' : 'bar-good';

    // Recommendations
    const recsHtml = (d.recommendations || []).map(
        r => '<li>' + r + '</li>'
    ).join('');

    return `
    <div class="dp-grid">
        <div>
            <div class="dp-section-title">Health Metrics</div>
            <div class="dp-bar-row">
                <span class="dp-bar-label">Avg CC</span>
                <div class="dp-bar"><div class="dp-bar-fill ${{ccBarCls}}" style="width:${{ccBar}}%"></div></div>
                <span class="dp-bar-val" style="color:${{d.avg_cc > 20 ? 'var(--critical)' : d.avg_cc > 8 ? 'var(--warning)' : 'var(--good)'}}">${{d.avg_cc}}</span>
            </div>
            <div class="dp-bar-row">
                <span class="dp-bar-label">Avg MI</span>
                <div class="dp-bar"><div class="dp-bar-fill ${{miBarCls}}" style="width:${{miBar}}%"></div></div>
                <span class="dp-bar-val" style="color:${{d.avg_mi < 40 ? 'var(--critical)' : d.avg_mi < 65 ? 'var(--warning)' : 'var(--good)'}}">${{d.avg_mi}}</span>
            </div>
            <div style="margin-top:4px;font-family:var(--font-mono);font-size:0.78em;color:var(--text-muted);">
                ${{d.nodes}} nodes &middot; ${{d.loc.toLocaleString()}} LOC
            </div>
            <div style="margin-top:16px;">
                <div class="dp-section-title">Recommendations</div>
                <ul class="dp-suggestions">${{recsHtml}}</ul>
            </div>
        </div>
        <div>
            <div class="dp-section-title">Files in this community (by CC)</div>
            ${{filesHtml || '<div style="color:var(--text-muted);font-style:italic;">No file details available</div>'}}
        </div>
    </div>`;
}}

document.querySelectorAll('.comm-row').forEach(row => {{
    row.addEventListener('click', () => {{
        const commId = row.dataset.commId;
        const detailRow = document.getElementById('comm-detail-' + commId);
        const panel = document.getElementById('comm-panel-' + commId);
        const isOpen = detailRow.style.display !== 'none';

        document.querySelectorAll('.comm-detail-row').forEach(r => r.style.display = 'none');
        document.querySelectorAll('.comm-row').forEach(r => r.classList.remove('expanded'));

        if (!isOpen) {{
            if (!panel.innerHTML) panel.innerHTML = renderCommPanel(commId);
            detailRow.style.display = 'table-row';
            row.classList.add('expanded');
        }}
    }});
}});

// ── Main Sequence dot drill-down ──
const MSD = {ms_dot_json};

document.querySelectorAll('.ms-dot').forEach(dot => {{
    dot.addEventListener('click', () => {{
        const cid = dot.dataset.cid;
        const d = MSD[cid];
        if (!d) return;

        const wasSelected = dot.classList.contains('selected');
        document.querySelectorAll('.ms-dot').forEach(x => x.classList.remove('selected'));

        const drilldown = document.getElementById('ms-drilldown');
        if (wasSelected) {{
            drilldown.innerHTML = '<div class="ms-drilldown-header">Click any dot</div><div class="ms-drilldown-empty">Hover for quick info, click to pin details</div>';
            return;
        }}
        dot.classList.add('selected');

        let zone = 'On Main Sequence';
        if (d.dist > 0.6) {{
            if (d.instab < 0.3 && d.abstr < 0.3) zone = 'Zone of Pain';
            else if (d.instab > 0.7 && d.abstr > 0.7) zone = 'Zone of Uselessness';
            else zone = 'Off sequence';
        }} else if (d.dist > 0.2) {{
            zone = 'Off sequence';
        }}

        drilldown.innerHTML =
            '<div class="ms-drilldown-header">Community ' + cid + '</div>' +
            '<div class="ms-drilldown-body">' +
            '<span class="md-label">' + d.label + '</span>' +
            '<div class="md-row"><span class="md-key">Zone</span><span>' + zone + '</span></div>' +
            '<div class="md-row"><span class="md-key">Instability (I)</span><span>' + d.instab.toFixed(2) + '</span></div>' +
            '<div class="md-row"><span class="md-key">Abstractness (A)</span><span>' + d.abstr.toFixed(2) + '</span></div>' +
            '<div class="md-row"><span class="md-key">Distance (D)</span><span>' + d.dist.toFixed(2) + '</span></div>' +
            '<div class="md-row"><span class="md-key">Fan-in</span><span>' + d.fan_in + '</span></div>' +
            '<div class="md-row"><span class="md-key">Fan-out</span><span>' + d.fan_out + '</span></div>' +
            '<div class="md-row"><span class="md-key">Nodes</span><span>' + d.nodes + '</span></div>' +
            '</div>';
    }});
}});
</script>

</body>
</html>"""

    out = Path("code-health-out")
    out.mkdir(exist_ok=True)
    (out / "health_report.html").write_text(html)
    print(f"HTML report: code-health-out/health_report.html")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python crossref.py analyze <src> | report | html")
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "analyze":
        src = sys.argv[2] if len(sys.argv) > 2 else "."
        results = analyze(src)
        generate_html(results)
    elif cmd == "report":
        data = json.loads(
            Path("code-health-out/crossref.json").read_text()
        )
        for r in data["top_risks"][:10]:
            print(
                f"  risk={r['risk']:>6.1f}  "
                f"deg={r['degree']:>3}  "
                f"cc={str(r['cc'] or '—'):>3}  "
                f"mi={str(round(r['mi'],1) if r['mi'] else '—'):>5}  "
                f"{r['label']}"
            )
    elif cmd == "html":
        generate_html()
    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)

#!/usr/bin/env python3
"""Print a read-only first look at a Scarf store: size, runs, artifacts, counts, cell metadata.

Usage:
    python inspect_store.py PATH_TO_STORE.zarr [--json summary.json] [--max-levels 8]
        [--sample-rows 300] [--show-annotation-values]

Nothing is written to the store. Values of annotation-like columns (possible author labels)
are hidden unless --show-annotation-values is given, so the output is safe before a blind
evaluation. The matrix check reads the first --sample-rows cells of the default assay counts
(one small read on a mount; 0 skips it). Column flags are name-based hints: review every
column. A store just written by a converter must be opened writable once before this works
(see references/data-access.md).
"""

import argparse
import json
import re
from collections import Counter

import numpy as np
import pandas as pd

import scarf

# Author or reference annotations. Hold them out when they will be used to evaluate results.
ANNOTATION_PATTERN = re.compile(
    r"cell.?type|annot|cluster|leiden|louvain|singler|predicted|azimuth|celltypist|"
    r"majority.?voting|ann.?level|subtype|lineage|cell.?label|cell.?state|snn.?res|"
    r"broad.?type|fine.?type|(?<!orig\.)ident|compartment|population|cell.?class|"
    r"ontology.?class|(^|[^a-z])(labels?|class)($|[^a-z])",
    re.IGNORECASE,
)
# Words in study-design column names: exact words, then word prefixes.
DESIGN_EXACT = {"age", "sex", "arm", "run", "day", "days", "dps", "dpi", "dpo", "dtf"}
DESIGN_EXACT |= {"hpi", "rep", "pid", "orig", "race", "hto", "hash"}
DESIGN_PREFIX = (
    "donor", "patient", "individual", "subject", "sample", "librar", "capture", "batch",
    "lane", "condition", "disease", "treatment", "status", "group", "timepoint", "time",
    "visit", "gender", "tissue", "ventil", "admission", "ward", "severity", "cohort",
    "stage", "respon", "outcome", "replicate", "chemistr", "protocol", "study", "site",
    "genotype", "infection", "vaccin", "dose", "ethnic", "ancestr",
)  # fmt: skip
# Words in author-computed QC metric and score names (nCount_RNA, percent.mt, S.Score).
DERIVED_EXACT = {"n", "mt", "hb", "qc", "pct", "umi", "umis", "dbl", "rp", "rpl", "rps"}
DERIVED_EXACT |= {"count", "counts", "ncount", "gene", "genes", "ngene", "ngenes"}
DERIVED_PREFIX = (
    "feature", "percent", "frac", "mito", "ribo", "rrna", "doublet", "scrublet",
    "phase", "complexity", "sct",
)  # fmt: skip
SCORE_PREFIX = ("score",)  # computed when continuous; clinical scores have few levels
AUTHOR_COUNTS = re.compile(r"^(n_?counts?|ncount|total_counts|n_?umis?)(_|$)", re.I)
AUTHOR_FEATURES = re.compile(r"^(n_?features?|ngenes?|n_genes)(_|$)", re.I)
AUTHOR_MITO = re.compile(
    r"percent.?(mt|mito)|pct_counts_mt|frac.?mito|mito.?frac", re.I
)
SKIPPED = {"I", "ids", "names"}


def name_words(name: str) -> list[str]:
    """Split a column name into lower-case words: 'nCount_RNA' -> ['n', 'count', 'rna']."""
    return [w.lower() for w in re.findall(r"[A-Z]+(?![a-z])|[A-Z]?[a-z]+|\d+", name)]


def has_word(words: list[str], exact: set[str], prefixes: tuple[str, ...]) -> bool:
    return any(w in exact or w.startswith(prefixes) for w in words)


def profile_column(values: np.ndarray, max_levels: int) -> dict:
    """Summarize one metadata column without printing per-cell values."""
    if values.dtype.kind in "iuf":
        finite = values[np.isfinite(values)] if values.dtype.kind == "f" else values
        n_levels = int(np.unique(finite).size)
        if n_levels > 20:
            return {
                "kind": "numeric",
                "levels": n_levels,
                "median": float(np.median(finite)) if finite.size else None,
                "min": float(finite.min()) if finite.size else None,
                "max": float(finite.max()) if finite.size else None,
                "missing": int(values.size - finite.size),
            }
    counts = Counter(map(str, values))
    top = dict(counts.most_common(max_levels))
    return {"kind": "categorical", "levels": len(counts), "top": top}


def classify(column: str, info: dict, assays: list[str], n_total: int) -> list[str]:
    """Name-based flags. Annotation wins over author-derived, which wins over design."""
    words = name_words(column)
    derived = has_word(words, DERIVED_EXACT, DERIVED_PREFIX) or (
        info["kind"] == "numeric" and has_word(words, set(), SCORE_PREFIX)
    )
    flags = []
    if ANNOTATION_PATTERN.search(column) and not derived:
        flags.append("annotation_like")
    elif column.split("_")[0] in assays:
        flags.append("scarf_column")
    elif derived:
        flags.append("author_derived")
    elif has_word(words, DESIGN_EXACT, DESIGN_PREFIX):
        continuous = info["kind"] == "numeric" and info["levels"] > 100
        flags.append("author_derived" if continuous else "design_like")
    elif info["kind"] == "numeric":
        flags.append("author_derived")  # continuous and not produced by Scarf
    elif 2 <= info["levels"] <= 50:
        flags.append("review")  # varying and unflagged: check whether it is design
    if info["levels"] == 1:
        flags.append("constant")
    if info["kind"] == "categorical" and info["levels"] >= 0.5 * n_total:
        flags.append("per_cell_identifier")
    return flags


def describe_metric(values: np.ndarray, floor: bool) -> dict:
    """Percentiles plus the share of cells within 5% of the minimum (a hard cutoff)."""
    values = values[np.isfinite(values)].astype(float)
    p = np.percentile(values, [0, 1, 50, 99, 100])
    share = float(np.mean(values <= p[0] * 1.05)) if floor and p[0] > 0 else None
    keys = ("min", "p1", "median", "p99", "max")
    return {**dict(zip(keys, map(float, p))), "floor_share": share}


def check_matrix(ds, assay: str, n_rows: int, hints: list[str]) -> dict:
    """Bounded, read-only checks for raw versus corrected or pre-filtered counts."""
    out: dict = {"assay": assay, "store": {}, "author": {}}
    if n_rows > 0:
        raw = ds.get_assay(assay).rawData
        # The first rows only: one small read, also on a mount.
        sample = raw[: min(n_rows, raw.shape[0])].compute()
        nonzero = sample[sample != 0]
        integer = float(np.mean(nonzero == np.round(nonzero))) if nonzero.size else 1.0
        out["sample"] = {
            "rows": int(sample.shape[0]),
            "dtype": str(sample.dtype),
            "integer_like": integer,
            "negatives": int((sample < 0).sum()),
            "max": float(sample.max()) if sample.size else 0.0,
        }
        if integer < 0.999 or out["sample"]["negatives"]:
            hints.append(
                "Values are not non-negative integers: the matrix looks normalized, "
                "scaled or log-transformed. Count-based QC and models do not apply."
            )
    columns = ds.cells.columns
    store = {k: f"{assay}_{k}" for k in ("nCounts", "nFeatures", "percentMito")}
    store = {k: c for k, c in store.items() if c in columns}
    active = ds.cells.to_pandas_dataframe(list(store.values()), key="I")
    for kind, col in store.items():
        values = active[col].to_numpy(dtype=float)
        out["store"][col] = describe_metric(values, floor=kind != "percentMito")
    if "nCounts" in store and "nFeatures" in store:
        spread = [
            np.subtract(*np.percentile(np.log1p(active[store[k]]), [95, 5]))
            for k in ("nFeatures", "nCounts")
        ]
        ratio = float(spread[0] / spread[1]) if spread[1] > 0 else None
        out["spread_ratio"] = ratio
        if ratio is not None and ratio > 1.0:
            hints.append(
                f"Detected genes spread more than totals across cells (log spread ratio "
                f"{ratio:.2f}; raw UMI data is usually below 1): totals look "
                "depth-equalized, for example SCTransform corrected counts."
            )
    authors = [
        c
        for c in columns
        if (AUTHOR_COUNTS.match(c) or AUTHOR_FEATURES.match(c) or AUTHOR_MITO.search(c))
        and c.split("_")[0] != assay
    ]
    frame = ds.cells.to_pandas_dataframe(authors, key="I") if authors else None
    for col in authors:
        values = pd.to_numeric(frame[col], errors="coerce")
        if values.notna().sum() < 10:
            continue
        kind = (
            "nCounts"
            if AUTHOR_COUNTS.match(col)
            else "nFeatures"
            if AUTHOR_FEATURES.match(col)
            else "percentMito"
        )
        info = describe_metric(
            values.to_numpy(dtype=float), floor=kind != "percentMito"
        )
        out["author"][col] = info
        if kind not in store:
            continue
        mine = active[store[kind]]
        rho = float(mine.corr(values, method="spearman"))
        ratio = float(np.nanmedian(mine / values.replace(0, np.nan)))
        info.update(versus=store[kind], spearman=rho, median_ratio=ratio)
        if "sct" in col.lower() and rho >= 0.99:
            hints.append(
                f"{store[kind]} matches author {col} (Spearman {rho:.3f}): the matrix "
                "holds the authors' SCT-corrected counts, not raw UMIs."
            )
        elif kind == "nCounts" and "sct" not in col.lower():
            same = rho >= 0.99 and 0.9 <= ratio <= 1.1
            verdict = (
                "counts look like the authors' raw counts."
                if same
                else "the matrix is not the layer the authors ran QC on "
                "(corrected counts, removed genes or another layer)."
            )
            hints.append(
                f"{store[kind]} {'matches' if same else 'differs from'} author {col} "
                f"(Spearman {rho:.3f}, median ratio {ratio:.2f}): {verdict}"
            )
    for col, info in [*out["store"].items(), *out["author"].items()]:
        if info["floor_share"] is not None and info["floor_share"] >= 0.005:
            hints.append(
                f"{col}: {info['floor_share']:.1%} of active cells sit within 5% of the "
                f"minimum {info['min']:,.0f}: a hard cutoff was applied before import."
            )
        if info["floor_share"] is None:  # percent mito: look for a round upper cutoff
            edge = [r for r in (5, 10, 15, 20, 25, 30) if 0.95 * r <= info["max"] <= r]
            if edge:
                hints.append(
                    f"{col}: maximum {info['max']:.2f} sits just below {edge[0]}%: "
                    "cells above it were probably removed earlier."
                )
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("store")
    parser.add_argument("--json", help="Also write the profile to this JSON file")
    parser.add_argument("--max-levels", type=int, default=8)
    parser.add_argument("--sample-rows", type=int, default=300, help="0 skips the read")
    parser.add_argument(
        "--show-annotation-values",
        action="store_true",
        help="Print values of annotation-like columns (not for blind evaluation)",
    )
    args = parser.parse_args()

    scarf.configure_output(level="ERROR", progress=False)
    ds = scarf.DataStore(args.store, zarr_mode="r")
    summary = ds.summary().to_dict()
    n_total = summary["total_cells"]
    assays = [assay["name"] for assay in summary["assays"]]

    print(f"Store: {args.store}")
    print(
        f"Cells: {summary['active_cells']:,} active of {n_total:,}; "
        f"default assay {summary['default_assay']}; resources {summary['resources']}"
    )
    for assay in summary["assays"]:
        kinds = Counter(item["ref"]["kind"] for item in assay["artifacts"])
        print(
            f"Assay {assay['name']} ({assay['assay_type']}): "
            f"{assay['active_features']:,} of {assay['total_features']:,} features; "
            f"artifacts {dict(sorted(kinds.items()))}"
        )
    print(f"Pipeline runs: {summary['pipeline_run_counts']}")
    for run in ds.pipeline.list_runs():
        print(f"  {run.label!r}: status={run.status}, run_id={run.run_id[:12]}")
    print(f"Mounted counts: {'matrixSource' in ds.z.attrs}")

    profile = {}
    for column in summary["cell_columns"]:
        if column in SKIPPED:
            continue
        info = profile_column(np.asarray(ds.cells.fetch_all(column)), args.max_levels)
        flags = classify(column, info, assays, n_total)
        if "annotation_like" in flags and not args.show_annotation_values:
            info = {"kind": info["kind"], "levels": info["levels"], "values": "hidden"}
        profile[column] = {**info, "flags": flags}

    rows = []
    for column, info in profile.items():
        if info.get("values") == "hidden":
            detail = "hidden (--show-annotation-values prints them)"
        elif info["kind"] == "numeric":
            detail = (
                f"numeric median {info['median']:.4g}, "
                f"range {info['min']:.4g} to {info['max']:.4g}"
            )
        else:
            detail = ", ".join(f"{k} ({v:,})" for k, v in info["top"].items())
        flags = ",".join(info["flags"])
        rows.append(
            {
                "column": column,
                "levels": info["levels"],
                "flags": flags,
                "values": detail[:90],
            }
        )
    with pd.option_context("display.max_rows", None, "display.width", 250):
        print(pd.DataFrame(rows).to_string(index=False))

    def flagged(name: str) -> list[str]:
        return [c for c, i in profile.items() if name in i["flags"]]

    varying_design = [c for c in flagged("design_like") if c not in flagged("constant")]
    print(f"\nAnnotation-like (hold out; values hidden): {flagged('annotation_like')}")
    print(f"Design-like, varying (check units and confounding): {varying_design}")
    print(
        f"Author-derived QC or scores (recompute, do not reuse): {flagged('author_derived')}"
    )
    print(
        f"Unflagged with 2 to 50 levels (review as possible design): {flagged('review')}"
    )

    hints: list[str] = []
    matrix = check_matrix(ds, summary["default_assay"], args.sample_rows, hints)
    if n_total > summary["active_cells"]:
        hints.append(
            f"I excludes {n_total - summary['active_cells']:,} of {n_total:,} cells: an "
            "earlier filter edited I, so active-cell ranges are truncated."
        )
    print(f"\nMatrix check ({matrix['assay']}, read-only):")
    if "sample" in matrix:
        s = matrix["sample"]
        print(
            f"  first {s['rows']} cells: dtype {s['dtype']}, integer-like "
            f"{s['integer_like']:.1%} of nonzeros, negatives {s['negatives']}, "
            f"max {s['max']:,.0f}"
        )
    for col, i in [*matrix["store"].items(), *matrix["author"].items()]:
        floor = "" if i["floor_share"] is None else f"; {i['floor_share']:.2%} near min"
        versus = (
            f"; Spearman {i['spearman']:.3f} with {i['versus']}, "
            f"median ratio {i['median_ratio']:.2f}"
            if "spearman" in i
            else ""
        )
        print(
            f"  {col}: min {i['min']:,.4g}, p1 {i['p1']:,.4g}, median {i['median']:,.4g}, "
            f"p99 {i['p99']:,.4g}, max {i['max']:,.4g}{floor}{versus}"
        )
    if matrix.get("spread_ratio") is not None:
        print(
            f"  log spread ratio nFeatures/nCounts (p5 to p95): {matrix['spread_ratio']:.2f}"
        )
    print("Hints (confirm before acting; see references/quality-control.md):")
    for hint in hints or [
        "No sign of corrected or pre-filtered counts in these checks."
    ]:
        print(f"  - {hint}")

    if args.json:
        payload = {
            "summary": summary,
            "columns": profile,
            "matrix": matrix,
            "hints": hints,
        }
        with open(args.json, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2, default=str)
        print(f"Wrote {args.json}")


if __name__ == "__main__":
    main()

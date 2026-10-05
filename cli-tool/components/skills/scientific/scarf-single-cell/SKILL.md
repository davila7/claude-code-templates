---
name: scarf-single-cell
description: Analyze single-cell data with core Scarf, the out-of-core Zarr DataStore library with immutable artifacts and pipeline runs. Covers opening, converting and mounting stores (including Cytebase datasets), QC with removal audits, HVG/PCA/neighbour graphs, Leiden/Paris clustering, UMAP, markers and cautious annotation, batch correction and donor-level comparisons, headless plotting, provenance and export. Use when a task involves a Scarf .zarr store, a Cytebase dataset, scarf.DataStore, ds.pipeline, or converting H5AD/10x/MTX/Seurat data for Scarf. Does not cover scarf.agent (the automated agent package).
license: BSD-3-Clause
compatibility: Requires Python 3.12+ and scarf 1.0.0rc17 or newer (pip install "scarf[extra]>=1.0.0rc17"; add the cytebase extra and network access for Cytebase datasets).
metadata:
  version: "0.4"
---

# Scarf single-cell analysis

Scarf streams Zarr-backed count matrices in bounded blocks and records every computation as an
immutable, content-addressed artifact. This skill encodes how to drive core Scarf for single-cell
RNA analysis: which calls to make, in what order, what evidence to check, and what not to do.
It does not use or describe `scarf.agent`.

Read this file first. Then open only the reference modules you need (index below). Paths in this
skill are relative to the skill directory. The maintained copy lives in the Scarf repository at
<https://github.com/NygenAnalytics/scarf/tree/master/skills/scarf-single-cell>.
Every recipe in the modules was run against a real store. Numbers quoted there come from the 10x
5K PBMC documentation dataset and are illustrations, not thresholds.

## Setup

- Install into the environment you run Python from: `pip install "scarf[extra]>=1.0.0rc17"`, plus
  `scarf[cytebase]` for Cytebase. The explicit pre-release floor matters: a bare `scarf[extra]` resolves
  to the old 0.32 series, whose API this skill does not describe.
- Set resources per process before importing Scarf. Defaults claim all detected RAM and every CPU:
  `SCARF_MEM_BUDGET=8G SCARF_WORKERS=8` (memory specs need a unit; a bare `8` is rejected).
- Headless: `MPLBACKEND=Agg`, call plots with `show=False`, then `result.save(path)` and
  `result.close()`.
- Quiet logs for scripts: `scarf.configure_output(level="WARNING", progress=False)`.
- `scripts/inspect_store.py STORE.zarr` prints a read-only first look: cell and feature counts,
  runs, artifact kinds, whether counts look raw, and a profile of every metadata column with
  design-like, annotation-like and author-derived columns flagged. Annotation values stay hidden
  unless you pass `--show-annotation-values`.
- Long steps (a pipeline run on tens of thousands of cells over remote counts can take many
  minutes): write the step as a script that logs to a file and ends with a `DONE` or `FAILED` line,
  run it in the background, and wait with a bounded loop that also stops on a `Traceback` or a dead
  process. If you launch through a wrapper such as `uv run`, put `timeout` inside it
  (`uv run timeout N python step.py`; the reverse can leave stale `running` records), and track the process by `$!` rather than `pgrep -f`. See
  `references/performance-and-export.md`. Never poll without a time limit.

## Mental model

- A **DataStore** is one Zarr directory: a shared cell table `ds.cells`, one group per assay
  (`ds.RNA`, feature table `ds.RNA.feats`, counts as cell-major `counts` plus gene-major `countsT`),
  artifacts, and `pipeline/runs`. QC columns are assay-prefixed: `RNA_nCounts`, `RNA_nFeatures`,
  `RNA_percentMito`, `RNA_percentRibo`.
- **`I`** is the live boolean cell key. Analytical filters never edit it; they return a frozen
  **cell selection** artifact.
- Every result is an **`ArtifactRef`** (`scope`, `kind`, `artifact_id`, `assay`). Producers take refs
  and return refs: `select_hvgs -> run_normalization -> run_pca -> build_ann_index ->
  query_neighbors -> build_connectivity_map -> run_leiden_clustering / run_umap ->
  run_marker_search`. An identical call returns the existing artifact without recomputing.
- **`ds.pipeline.run(label=...)`** runs that whole RNA recipe (filtering, cell cycle, HVG,
  normalization, PCA, graph, UMAP, Leiden at 0.5/0.75/1.0/1.25 with a silhouette pick, Paris,
  doublet scores, markers) and returns a durable **`PipelineRun`**: a mapping of output names to
  refs plus frozen `run.cells` / `run.features` views and `run.report()`.
- Artifact payload rows follow the artifact's **cell selection**, not `ds.cells.N`.
- A **mount** is a local writable store whose counts stay in a remote source (`matrixSource`).
  Every pass over counts is a network read; artifacts are written locally.

## Golden rules

1. **Inspect read-only first.** `scarf.DataStore(path, zarr_mode="r")` writes nothing. A writable
   open (the default) prepares new stores and applies `min_features_per_cell` (default 10) to `I`
   permanently. Reopen existing stores and mounts with
   `scarf.DataStore(path, min_features_per_cell=-1)`.
2. **Never filter by editing `I`.** Keep the `cell_selection` ref a filter returns and pass it on, or
   insert a boolean column and use `cell_key=`. `ds.cells.reset_key("I")` undoes an accidental
   open-time filter.
3. **Keep every ref you will reuse in a dict** and record them. Never guess artifact IDs or read
   private Zarr paths. Use `ds.inspect_artifact(ref)`, `ds.load_artifact(ref)` and
   `ds.list_artifacts(...)`. Cell selections need `scope="datastore"` when listing.
4. **Check the matrix, then audit QC removals before accepting a filter.** Published matrices can
   be corrected (for example SCTransform) or already filtered, which makes QC bounds meaningless;
   `scripts/inspect_store.py` reports this. Pooled MAD filters routinely remove low-complexity
   populations (platelets, erythrocytes, neutrophils) and high-RNA ones (plasma, cycling cells).
   Audit retention per sample and per marker-defined group without author labels, and look at the
   markers of removed cells (`references/quality-control.md`).
5. **Labels are immutable and runs cannot be resumed.** Use a new `label` for every variant. A rerun
   reuses every complete artifact, so it is cheap. Choose `snapshot_columns` (design columns you
   want inside `run.cells` and exports) on the first run, because changing them recomputes
   everything downstream.
6. **Read pipeline outputs instead of recomputing them.** `run["markers"]`, `run["cell_cycle"]` and
   `run["doublets"]` already exist. A direct `run_marker_search(run["clusters"], ...)` creates a new
   artifact and rereads all counts.
7. **Align arrays through the cell selection.** Use `run.cells.fetch(...)` (run cells only) or
   `fetch_all(...)` (full length, with -1, NaN or "" outside the run). For explicit artifacts use
   `ds.inspect_artifact(ref).input_ref("cell_selection")`. Join tables on cell `ids`, never on row
   order.
8. **Budget count passes on mounts.** QC metrics, the HVG summary, normalization per selection,
   markers, gene plots and AUCell each read counts. For many passes, make a local copy once:
   `python -m scarf.tools.repack_zarr MOUNT.zarr LOCAL.zarr --mem-budget 4G`.
9. **One DataStore per process; it is not thread-safe.** Run parallel analyses in separate
   processes on separate stores, each with its own `SCARF_MEM_BUDGET`/`SCARF_WORKERS`.
10. **Payload names differ by kind.** Leiden labels, embeddings, doublet and strength scores live
    under `values`; Paris (`cluster_cut`) under `labels`; PCA under `data`. `get_markers` returns
    string `group_id` while Leiden labels are integers.
11. **`get_markers` defaults hide genes.** `min_score=0.25, min_frac_exp=0.2`; pass `-1` for both
    to see negatives and full panels.
12. **Labels are hypotheses.** Name a cluster only with two or more specific positive markers plus
    low lineage-negative markers and a plausible QC and doublet profile. Keep `unresolved` for
    mixed, doublet-like or marker-poor clusters.
13. **Cells are not replicates, and Scarf does not check your design.** Condition claims need
    donor-level aggregation and at least two independent donors per group. A donor sampled twice is
    repeated measures. A donor with samples in two arms must not count in both:
    `run_statistical_testing(sample_by="sample_id")` silently does that, while `sample_by="donor_id"`
    refuses such a design. `run_harmony` runs silently on a column confounded with the biology you
    want to compare, so audit donors x batch x condition first. When inserting design columns, replace
    missing values explicitly: `ds.cells.insert` stores `None` as `""` and `pd.NA` as `"<NA>"`.
14. **Hold out annotation columns when they will judge the result.** Do not use author labels
    (`cell_type`, `author_cell_type`, `cell.type.*`, `singler`, `predicted.*`, ...) to choose QC,
    parameters or labels. Use them only in a final, clearly separated comparison.
15. **Pass an explicit HVG blacklist.** On stores with current gene symbols the default blacklist
    misses replication-dependent histones (`^HIST` matches only pre-2020 names), and its `^CCN`
    family removes the CCN1-6 matricellular genes and non-cell-cycle cyclins. It also leaves Ig V/J
    genes in, which can split plasma cells by light chain instead of biology. Use the species string
    from `references/gene-blacklists.md` (`params={"hvg": {"blacklist": ...}}` in the pipeline). Add
    the clonotype add-on only on marker evidence. A `blacklist=` string replaces the default
    entirely, and changing it creates new HVG, PCA and graph artifacts.

## The analysis loop

Work in this order. After each step, write the decision and its evidence to an analysis log.

| Step | Do | Evidence to record | Module |
|---|---|---|---|
| 1. Inspect | `scripts/inspect_store.py`, `ds.summary()`, existing runs; check raw versus corrected counts | cells, assays, mounted or local, count type, metadata roles | `data-access.md`, `quality-control.md` |
| 2. Design | identify donor, sample, capture, batch and condition columns; derive missing units | unit of inference, confounding, held-out columns | `integration-and-comparisons.md` |
| 3. QC | inspect distributions; compare policies; audit removals | chosen policy, cells kept per group, what was removed | `quality-control.md` |
| 4. Baseline | `ds.pipeline.run(label=..., filtering=<chosen>, snapshot_columns=<design>)` | run id, report, kept cells | `pipeline-runs-and-artifacts.md` |
| 5. Structure | resolutions, seed stability, nesting, marker support, QC and doublets per cluster | chosen partition and why | `clustering-and-embedding.md` |
| 6. Branch if needed | HVG count and blacklist, PCs, `k`, subclustering one lineage, Harmony (only if the design allows) | which alternative changed what | `features-and-graphs.md`, `gene-blacklists.md`, `integration-and-comparisons.md` |
| 7. Annotate | marker tables, canonical panels, gene-set scores | label, markers, negatives, unresolved clusters | `markers-and-annotation.md` |
| 8. Compare | composition per donor, pseudobulk; only with replicates | what can and cannot be claimed | `integration-and-comparisons.md`, `performance-and-export.md` (pseudobulk export) |
| 9. Report | figures, tables, handoff JSON, lineage, export | files written, open questions | `plotting.md`, `performance-and-export.md` |

## Quick start

A complete first pass on an RNA store. Every step after the run reuses the run's artifacts.

```python
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # headless; select the backend before importing scarf
import numpy as np
import pandas as pd
import scarf

scarf.configure_output(level="WARNING", progress=False)
store = "analysis.zarr"
out = Path("analysis_out")
(out / "figures").mkdir(parents=True, exist_ok=True)

ds = scarf.DataStore(store, min_features_per_cell=-1)

# QC: compare candidate filters and audit them before choosing (quality-control.md).
cells = ds.snapshot_cell_selection("I")
mad5 = ds.auto_filter_cells(cell_selection=cells, n_mads=5)
kept = np.asarray(ds.load_artifact(mad5)["values"][:], dtype=bool)
print(f"MAD 5 keeps {kept.sum()} of {ds.cells.N} cells")

# Baseline run with the chosen policy; freeze design columns you will need later.
run = ds.pipeline.run(
    label="baseline_mad5",
    filtering={"method": "mad", "n_mads": 5},
    snapshot_columns=[c for c in ("donor_id", "sample_id") if c in ds.cells.columns],
)
print(run.status, list(run.keys()))
(out / "run_report.md").write_text(run.report(format="markdown"))

# Figures and tables.
umap = ds.plots.embedding(run=run, color_by="clusters", show=False)
umap.save(out / "figures" / "umap_clusters.png", dpi=150)
umap.close()
markers = ds.get_markers(marker=run["markers"])
markers.to_csv(out / "markers_top.csv", index=False)
print(markers.groupby("group_id", sort=False).head(5)
      .groupby("group_id", sort=False)["feature_name"].agg(", ".join))
sizes = pd.Series(run.cells.fetch("clusters")).value_counts().sort_index()
print(sizes.to_dict())
```

## Record the analysis

Keep these in the output directory so another agent or a person can audit and continue:

- `analysis_log.md`: the question, the units, and one entry per step (decision, alternatives
  considered, evidence with numbers, figure paths).
- `handoff.json`: run label and ID, and the refs you relied on (`ref.to_dict()`; restore with
  `scarf.ArtifactRef.from_dict`). Add unsupported claims and open questions. See
  `pipeline-runs-and-artifacts.md`.
- `run_report.md` (`run.report(format="markdown")`) and `lineage.md`
  (`ds.lineage({...}).to_markdown()`).
- Figures saved as PNG, and tables as CSV (markers, cluster sizes, composition, label map).

## Evaluating against held-out labels

When a dataset ships author annotations, run the whole loop without them. Then add one final
section that crosstabs your labels against theirs, reports ARI and per-type F1 after harmonizing
vocabularies, and explains disagreements with marker evidence. Report QC retention per author type
there too, as an audit of the filter. Never go back and tune parameters to raise agreement. Record
any changes you make after seeing the comparison as such.

## Reference modules

| Module | Read when |
|---|---|
| `references/data-access.md` | opening, inspecting, converting (H5AD, 10x, MTX, Seurat), Cytebase search, open and mount |
| `references/quality-control.md` | QC metrics, MAD/manual/per-sample filters, removal audits, doublet scores |
| `references/features-and-graphs.md` | HVGs, normalization, PCA dims, ANN, neighbours, graph diagnostics, branching, subclustering |
| `references/gene-blacklists.md` | what the default HVG blacklist removes, corrected blacklists for human and mouse, Ig/TCR and haemoglobin add-ons |
| `references/clustering-and-embedding.md` | Leiden and Paris, choosing a partition, UMAP and t-SNE, labels as arrays |
| `references/markers-and-annotation.md` | marker tables, canonical marker panels, labelling, AUCell/WAGGR, cell cycle, label comparison |
| `references/pipeline-runs-and-artifacts.md` | `ds.pipeline.run` options, run reports, artifacts, lineage, failures, handoff record |
| `references/plotting.md` | headless figures, run mode versus ref mode, every `ds.plots` method |
| `references/integration-and-comparisons.md` | study design and units, donors in two arms, composition tests, Harmony and its safety, merging, mapping, condition comparisons |
| `references/performance-and-export.md` | budgets, long-running steps, streaming, mount repacking, AnnData/H5AD/MTX/CSV and pseudobulk export, subset stores |

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Assay 'RNA' is not prepared` on a read-only open | store just written by a converter or `SubsetZarr` | open once writable, then read-only |
| Fewer active cells than expected after opening | writable open applied `min_features_per_cell` | `ds.cells.reset_key("I")`; reopen with `-1` |
| `ValueError` on `ds.pipeline.run(label=...)` | label already completed | new label; reuse makes it cheap |
| `PermissionError` from a producer | store opened with `zarr_mode="r"` and no matching artifact | reopen writable |
| `KeyError: 'values'` on a Paris ref | Paris stores `labels` | `ds.load_artifact(ref)["labels"]` |
| Array length differs from `ds.cells.N` | payload follows the cell selection | align with `run.cells.fetch_all` or the selection mask |
| Plot raises with `run=` and a gene or live column | run mode accepts one frozen field only | `layout=run["umap"], color_by=[...]` |
| `TypeError` from `distribution(grouping="col")` | grouping needs a ref or `CellField` | `grouping=scarf.plotting.CellField("col")` |
| Very slow steps on a mount | each count pass is a network read | fewer passes; repack locally (rule 8) |
| `MemoryError` (`CountLayoutMemoryError` after 1.0.0rc19) from a converter | default count layout does not fit `mem_budget` | larger `mem_budget`; else the `policy=` the message names (`references/data-access.md`) |
| `ValueError` plotting after reopening the store | a `PipelineRun` is bound to the store object that opened it | reopen the run from the new `ds` |
| `list_artifacts(kind="cell_selection")` is empty | cell selections are datastore-scoped | add `scope="datastore"` |
| `KeyError: 'groups'` in a dot plot table | with `group_by=` the column is named after the grouping column | read `res.tables["aggregate"].columns` first |
| A wait for a long step never ends | unbounded polling, or the process died | bounded wait that checks the process and the log tail (Setup) |
| QC bounds look odd or nothing is filtered | counts are corrected or already filtered | check the matrix first; prefer flag-only or gentle filters |
| `ValueError: None of the s_genes match the assay feature names` from `ds.pipeline.run` | feature names are not gene symbols (Ensembl IDs, synthetic names); matching ignores case, so mouse symbols work | `cell_cycle=False`, or pass lists in the store's naming via `params={"cell_cycle": {"s_genes": [...], "g2m_genes": [...]}}` |

## Documentation map

The docs hold the full explanations, online at <https://scarf.readthedocs.io/en/latest/>:
`quickstart.html`, `tutorials/<step>.html` (one page per step, for example `quality_control`,
`graph_construction`, `clustering`, `annotation`, `batch_correction`,
`pseudobulk_and_differential_expression`, `cytebase`), `concepts/` (`provenance`,
`memory_and_execution`, `benchmarks`), `analysis_with_agents.html` (scientific decision loop, task
routing, handoff) and `reference/api/<module>.html` (exact signatures).

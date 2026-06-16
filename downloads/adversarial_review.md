# Adversarial Trust Review: Cadot Broad 156 Three-Metric Site Outputs

Review date: 2026-06-15

Scope: local adversarial review of the generated Gini/Theil/HHI Cadot-style broad-sample outputs in `results/samples/cadot_broad_156/three_metric_tables`.

Independence note: this was not a fresh subagent review. The available subagent tool policy permits spawning only when the user explicitly asks for sub-agents, so the review was performed locally.

## Executive Verdict

Cleared for staging deployment with caveats. The generated outputs satisfy the stated sample gate and validation checks: 156 selected reporters, 3,787 raw files processed, no product-dependent `999999`, fixed Theil product universes by flow, HHI within `[0,1]`, negligible Theil decomposition residuals, and complete cross-metric row parity for website-facing metric comparisons.

## Highest-Risk Findings

1. Exercise 11 is retained as top absolute leave-one-out product contributions, not a full all-product long table. The pipeline computes metric-specific leave-one-out contributions and keeps the top 25 per metric/reporter-year-flow. This is consistent with a website-sized output, but it should not be described as a complete downloadable all-product contribution universe.

2. Exercise 10 uses 250 random simulations per reporter-year-flow benchmark. This is suitable for descriptive website benchmarks, but the random benchmark tables should be interpreted as simulation summaries, not exact analytical null distributions.

3. The pipeline is descriptive and site-facing. No causal identification, fixed-effects model, clustered inference, or regression estimate is being claimed in these outputs.

## Data Lineage And Sample Audit

- Sample rule: `cadot_broad_156`, 2000-2024, minimum 19 annual HS final-data years.
- Reporter gate: passed with exactly 156 selected reporters.
- Raw files processed: 3,787.
- Availability convention: available-observation rows are retained; balanced 2000-2024 flags are recorded separately.
- Balanced reporter-flow cells: 221 total, with 109 export cells and 112 import cells.
- Product-dependent outputs exclude HS6 `999999` before aggregation.
- Partner-only concentration follows the project rule: product identity is summed away, HS6 `999999` may contribute to totals, and `partnerCode == 0` is excluded.

## Merge And Key Audit

- `unique_reporter_year_flow_dimension_variant`: passed, duplicate rows = 0.
- `cross_metric_key_parity`: passed, rows with missing metric = 0.
- `raw_files_present_for_available_country_years`: passed, missing available bulk keys = 0.
- The main wide metric panel has 22,572 rows:
  - product baseline: 7,509 rows
  - partner baseline: 7,554 rows
  - product-partner-cell baseline: 7,509 rows

## Variable Construction Audit

- Gini: current active-positive convention retained.
- Theil headline: fixed-universe product Theil, `sum_p s_cpft * log(s_cpft * K_f)`.
- Theil active/inactive decomposition: residual maximum absolute value is approximately `8.88e-16`, consistent with numerical precision.
- Fixed Theil product universe counts:
  - Exports: 6,873 products
  - Imports: 6,891 products
- HHI headline: raw `sum_i s_i^2`; observed range is `[0.0003039489512274, 1.0]`.

## Specification And Reporting Audit

- The website-facing metric comparisons use common reporter-year-flow rows across Gini, Theil, and HHI.
- Exercise complete-case flags are present in the main panel for Exercises 1, 2, 3, 4, 6, 10, 11, and 12.
- Output manifest records formulas, sample window, reporter count, raw-file count, product universes, and output paths.
- The planned Theil appendix is implemented as a product-destination/cell Theil analogue in the site builder, distinct from the fixed-universe product Theil headline.

## Replication Checklist

- Reproducible command used for the full run:
  `python3 scripts/run_cadot_three_metric_pipeline.py --fresh-checkpoints --simulations 250 --top-loo-products 25 --chunk-rows 500000`
- Unit tests passed for concentration metric helpers:
  `python3 -m unittest tests.test_concentration_metrics`
- Static-site builder smoke test passed on dry-run outputs before the full run.
- Validation file: `validation_checks.csv`, all 9 checks passed.

## Minimal Patch Plan

No blocking patch is required before staging deployment. If a full all-product Exercise 11 downloadable table is required later, add a separate heavy-output mode rather than overloading the website default.

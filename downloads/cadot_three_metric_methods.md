# Cadot Broad 156 Three-Metric Run

Generated: 2026-06-15T19:29:51+00:00

This run builds a common Cadot-style 156-reporter website bundle for Gini,
Theil, and HHI over annual HS6 UN Comtrade final-data files in 2000-2024.

## Measures

- Gini: active-positive Gini over observed positive trade values.
- Theil headline: fixed-universe product Theil, `sum_p s_cpft * log(s_cpft * K_f)`, where `K_f` is the flow-specific product universe over the Cadot-156 run.
- HHI headline: raw `sum_i s_i^2` on `[0,1]`.
- Product-dependent outputs exclude HS6 `999999` before aggregation.
- Partner-only concentration includes `999999` after product identity is summed away; partner `0` World is excluded by the raw leaf extractor.

## Sample

- Selected reporters: 156
- Raw files processed: 3787
- Product universes: `{"Exports": 6873, "Imports": 6891}`
- Complete balanced reporter-flow cells: 221

## Validation

| check                                         | passed   | details                            |
|:----------------------------------------------|:---------|:-----------------------------------|
| selected_reporter_count_156                   | True     |                                    |
| no_product_dependent_999999                   | True     | bad_product_ids=0                  |
| unique_reporter_year_flow_dimension_variant   | True     | duplicate_rows=0                   |
| hhi_bounds_0_1                                | True     | bad_rows=0                         |
| fixed_theil_universe_counts_by_flow           | True     | {'Exports': 6873, 'Imports': 6891} |
| theil_decomposition_residuals                 | True     | bad_rows=0                         |
| cross_metric_key_parity                       | True     | rows_with_missing_metric=0         |
| raw_files_present_for_available_country_years | True     | missing_available_bulk_keys=0      |
| exercise_06_unique_keys                       | True     | duplicate_rows=0                   |

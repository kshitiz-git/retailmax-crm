# Cleaning report

Produced by `analysis/clean_dataset.py` from `data/dataset_raw_combined.csv`. Re-running the script rewrites this file.

## Summary

| Item | Value |
|---|---|
| Rows in (raw combined file) | 5,020 |
|   of which HCL original rows | 500 |
|   of which generated rows (incl. duplicate copies) | 4,520 |
| Rows out (`data/dataset.csv`) | 4,961 |
| Rows removed | 59 (1.18%) |
| Churn rate after cleaning | 15.14% (751 of 4,961) |
| Nulls after cleaning | 0 |
| Unique customer_id | yes |

## Rules, in the order they run

A row is counted under the first rule that fires on it. Rules that fix or impute keep the row.

| Rule | What is wrong | Action | Rows |
|---|---|---|---:|
| R1 | Exact duplicate rows (all 9 columns identical) | dropped, first copy kept | 20 |
| R2a | region text with wrong case or padding (north, ' South ', WEST) | fixed: strip + Title Case | 8 |
| R2b | age_group text with padding ('26-35 ') | fixed: strip | 6 |
| R3 | churn_flag written as Yes/No/Y/N/true/false | fixed: mapped to 1/0 | 6 |
| R4 | non-numeric text in a numeric column | set to missing (then rules below apply) | 0 |
| R5 | age_group / region not in the allowed list (Unknown, N/A, ?) | set to missing (imputed in R12) | 4 |
| R6 | customer_id repeated with different content | dropped, first row kept | 0 |
| R7 | missing customer_id or churn_flag (the target label) | dropped | 6 |
| R8 | missing last_purchase_days or purchase_freq (core RFM inputs) | dropped | 5 |
| R9 | negative avg_order_value (sign-entry error) | fixed: absolute value (assumption: only the sign is wrong) | 12 |
| R10 | negative loyalty_points (points cannot be below zero) | set to missing (imputed in R12) | 6 |
| R11a | last_purchase_days outside 1-365 | dropped | 14 |
| R11b | purchase_freq outside 1-48 | dropped | 8 |
| R11c | avg_order_value outside 100-25000 INR (decimal slip) | dropped | 6 |
| R11d | loyalty_points above 9999 | dropped | 0 |
| R12-age_group | missing age_group | imputed with the mode (26-35) | 12 |
| R12-region | missing region | imputed with the mode (West) | 8 |
| R12-avg_order_value | missing avg_order_value | imputed with the median (7941.45) | 10 |
| R12-loyalty_points | missing loyalty_points | imputed with the median (1349.0) | 14 |
| R13 | rfm_segment recomputed with the shared RFM rule | replaced (labels HCL supplied do not follow the rule) | 777 |

Why these choices:

- The churn label and the two inputs of the RFM rule (recency, frequency) are never imputed. An invented label would train the model on made-up answers, and an invented recency would move a customer into the wrong segment.
- Average order value and loyalty points are imputed with the median, categories with the mode. These fields do not decide the segment or the label, and the median is not pulled by outliers.
- A negative order value is read as a sign error and made positive. This is an assumption; the other option is to drop the row, which would remove 12 more rows out of about 5,000.
- Out-of-range values are dropped, not clipped, because clipping a recency of 900 to 365 would claim knowledge we do not have.
- Valid ranges: purchase_freq 1-48, avg_order_value 100-25,000 INR, last_purchase_days 1-365, loyalty_points 0-9,999. They come from the HCL file (observed 1-48, 266-19,904, 1-365, 38-9,997) with a little slack on order value.

## rfm_segment: why it was recomputed (R13)

The shared RFM rule gives each customer a score from 1 to 5 on recency, frequency and spend (quintiles) and maps the scores to a segment. The segment labels in HCL's file do not follow that rule:

- HCL original rows, rule applied to the 500 rows alone: **19.4%** of the given labels match (random labels would match about 20%).
- HCL original rows, rule applied over all 4,961 cleaned rows: 16.6% match.
- Generated rows: 91.9% keep their label. The other 8.1% change because the quintile cut-offs move when the 500 original rows (recency spread evenly over 1-365 days) join the data.

The React app computes the segment with the same rule on whatever rows it loads, so the CSV now carries the same value the app shows. The original labels are kept in `data/dataset_original.csv`.

## Check against the injected faults (`anomaly_labels.csv`)

The cleaner never reads the labels while cleaning. After it finishes, this table asks: for every fault the generator injected, did the rule that should catch it fire on that customer_id?

| Fault injected | Column | Injected | Caught by | Caught | Outcome |
|---|---|---:|---|---:|---|
| duplicate_row | * | 20 | R1 | 20 | removed |
| missing_value | age_group | 8 | R12-age_group | 8 | imputed |
| missing_value | region | 8 | R12-region | 8 | imputed |
| missing_value | avg_order_value | 10 | R12-avg_order_value | 10 | imputed |
| missing_value | loyalty_points | 8 | R12-loyalty_points | 8 | imputed |
| missing_value | last_purchase_days | 5 | R8 | 5 | row removed |
| missing_value | churn_flag | 6 | R7 | 6 | row removed |
| negative_value | avg_order_value | 12 | R9 | 12 | fixed |
| negative_value | loyalty_points | 6 | R12-loyalty_points | 6 | imputed |
| out_of_range | last_purchase_days | 14 | R11a | 14 | row removed |
| out_of_range | purchase_freq | 8 | R11b | 8 | row removed |
| out_of_range | avg_order_value | 6 | R11c | 6 | row removed |
| format_inconsistency | region | 8 | R2a | 8 | fixed |
| format_inconsistency | age_group | 6 | R2b | 6 | fixed |
| format_inconsistency | churn_flag | 6 | R3 | 6 | fixed |
| invalid_category | age_group | 4 | R12-age_group | 4 | imputed |

Total: 135 of 135 injected faults caught by the expected rule (100.0%).

Note on limits: this check only covers faults the generator can label. A wrong value that still lies inside the valid range (for example an order value of 9,000 typed as 900) passes every rule. Range checks cannot find those, and the report says so instead of claiming the file is perfect.

## Profile of the cleaned file

| Column | dtype | min | max | distinct |
|---|---|---:|---:|---:|
| customer_id | string | - | - | 4,961 |
| age_group | string | - | - | 5 |
| region | string | - | - | 5 |
| purchase_freq | int64 | 1 | 48 | 48 |
| avg_order_value | float64 | 266.11 | 19950 | 4,853 |
| last_purchase_days | int64 | 1 | 365 | 364 |
| loyalty_points | int64 | 16 | 9999 | 2,948 |
| churn_flag | int64 | 0 | 1 | 2 |
| rfm_segment | string | - | - | 5 |

Segment counts: At_Risk 1,445, Champion 1,016, Lost 909, Loyal 885, New 706.

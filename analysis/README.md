# RetailMax CRM: data science pipeline

Offline Python pipeline that prepares the data, trains the churn model and produces the EDA notebook.
The React app in `src/` never calls Python. It reads two files this pipeline writes:
`src/data/customers.csv` and `src/data/churn-model.json`.

```
dataset_original.csv (HCL, 500 rows)
        |
        v
 1. generate_dataset.py   -> data/dataset_raw_combined.csv + data/anomaly_labels.csv
        |
        v
 2. clean_dataset.py      -> data/dataset.csv, data/cleaning_report.md, data/data_dictionary.csv,
        |                    src/data/customers.csv (byte-identical copy of dataset.csv)
        v
 3. train_churn_model.py  -> src/data/churn-model.json
        |
        v
 4. eda.ipynb             -> executed notebook + docs/figures/*.png
```

## Run it (from the project root)

```bash
python -m venv .venv
.venv/Scripts/python -m pip install -r analysis/requirements.txt     # Linux/macOS: .venv/bin/python

.venv/Scripts/python analysis/generate_dataset.py
.venv/Scripts/python analysis/clean_dataset.py
.venv/Scripts/python analysis/train_churn_model.py
.venv/Scripts/python -m jupyter nbconvert --to notebook --execute --inplace analysis/eda.ipynb
```

Each script prints a summary and exits 0 on success. Run them in this order; each one reads the previous one's output.
The whole pipeline takes about two minutes on a laptop. The generator and cleaner are deterministic
(seed 42): running them twice gives identical files. `train_churn_model.py` also uses seed 42, but writes a
fresh `trained_at` timestamp into the JSON on every run.

## What each script does

| Script | Input | Output | Notes |
|---|---|---|---|
| `generate_dataset.py` | `data/dataset_original.csv` | `data/dataset_raw_combined.csv`, `data/anomaly_labels.csv` | 4,500 rows (ids C00501 to C05000) from six hidden customer types, so frequency, recency, order value and loyalty points are correlated. Churn probability rises with recency and falls with frequency; the intercept is tuned so about 15% churn. Then 135 labelled faults (about 2.7% of 5,000 rows) go into the raw file: 20 duplicates, 45 missing values, 18 negative values, 28 out-of-range values, 20 format errors, 4 invalid categories. Also holds the shared RFM rule (`rfm_scores`, `segment_for`, `rfm_segments`). |
| `clean_dataset.py` | `data/dataset_raw_combined.csv` | `data/dataset.csv`, `data/cleaning_report.md`, `data/data_dictionary.csv`, `src/data/customers.csv` | 13 numbered rules (R1 to R13) (see `data/cleaning_report.md` for each rule and its count). It never reads the fault labels while cleaning; it reads them at the end to check what it caught. Recomputes `rfm_segment` with the shared rule. Asserts the final contract (no nulls, unique ids, ranges, 4,850 to 5,000 rows). |
| `train_churn_model.py` | `data/dataset.csv` | `src/data/churn-model.json` | Logistic regression (balanced classes, L2) and random forest on 4 standardised numeric columns plus one-hot age group and region. `rfm_segment` is not a feature (it is computed from recency and frequency, so it would leak). Stratified 80/20 split, seed 42. Exports the logistic regression. Ends with a self-check that scores test rows from the JSON file in pure Python and compares with scikit-learn to 1e-6. |
| `eda.ipynb` | all of the above | executed notebook, `docs/figures/fig00` to `fig10` | 11 charts, each with a short commentary. |

## The shared RFM rule

The React app uses the same rule (`src/lib/data/derive.ts`). Change it in both places or in neither.

- Recency = `last_purchase_days` (lower is better). Frequency = `purchase_freq`. Monetary = `purchase_freq * avg_order_value`.
- Scores 1 to 5 by quintile over the rows being scored (`pandas.qcut` on `rank(method="first")`). 5 = most recent, most frequent, highest spend.
- Segment: R >= 4 and F >= 4 is Champion; else F >= 3 and R >= 3 is Loyal; else R >= 4 and F <= 2 is New; else R <= 2 and F >= 3 is At_Risk; else R <= 2 and F <= 2 is Lost; else (R = 3, F <= 2) is At_Risk.

For some row counts pandas `qcut` and the app's integer formula put one customer on the other side of a quintile cut-off.
For the 4,961 rows in `dataset.csv` they agree on every customer (checked: 0 differences).

## Model JSON contract

The app computes `p = sigmoid(intercept + sum(coef[f] * z))`, where `z = (x - mean) / std` for the four numeric columns
and `z = 1` if the customer has that category (`age_group=26-35`, `region=West`, ...), else 0. All five age groups and all five
regions have a coefficient (no dropped category). Retraining only needs a new `churn-model.json`; no app code changes.

Note: `class_weight="balanced"` pushes the predicted probabilities up compared with the real 15% churn rate. Treat `p` as a
risk score for ranking customers and for the 0.5 flag, not as a literal probability of leaving.

## The 500 HCL rows

`data/dataset_original.csv` is statistically random: churn is 13.7% to 20.0% in every given segment and mean recency is
182 to 203 days in every segment. A model trained on those 500 rows alone has ROC-AUC 0.475 (10 x 5-fold CV),
which is chance. The 4,500 generated rows carry the patterns. Details: `docs/PROJECT_REPORT.md` section 5 and `analysis/eda.ipynb`.

## Files you can delete and regenerate

`data/dataset_raw_combined.csv`, `data/anomaly_labels.csv`, `data/dataset.csv`, `data/cleaning_report.md`,
`data/data_dictionary.csv`, `src/data/customers.csv`, `src/data/churn-model.json` and `docs/figures/*.png` are all outputs.

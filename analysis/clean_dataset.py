"""Clean data/dataset_raw_combined.csv into the deliverable data/dataset.csv.

Every rule below is counted and written to data/cleaning_report.md. The cleaner does NOT read
anomaly_labels.csv to decide anything; it only reads it at the end to check how many of the
injected faults the rules actually caught.

Outputs:
    data/dataset.csv            cleaned deliverable (same 9 columns, same order as HCL's file)
    data/cleaning_report.md     rows in / rows out / per-rule counts / ground-truth cross-check
    data/data_dictionary.csv    one described row per column, samples taken from the cleaned file
    src/data/customers.csv      byte-identical copy that the React app imports

Run:  python analysis/clean_dataset.py
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

import numpy as np
import pandas as pd

from generate_dataset import (  # same folder; also holds the shared RFM rule
    AGE_GROUPS, AOV_RANGE, COLUMNS, FREQ_RANGE, POINTS_RANGE, RECENCY_RANGE, REGIONS, rfm_segments,
)

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RAW = DATA / "dataset_raw_combined.csv"
LABELS = DATA / "anomaly_labels.csv"
OUT = DATA / "dataset.csv"
REPORT = DATA / "cleaning_report.md"
DICTIONARY = DATA / "data_dictionary.csv"
FRONTEND_COPY = ROOT / "src" / "data" / "customers.csv"

NUMERIC = ["purchase_freq", "avg_order_value", "last_purchase_days", "loyalty_points"]
CHURN_TEXT = {"1": 1, "0": 0, "1.0": 1, "0.0": 0, "yes": 1, "y": 1, "true": 1, "no": 0, "n": 0, "false": 0}

rules: list[dict] = []        # ordered log: id, description, action, count
touched: dict[str, set] = {}  # rule id -> customer_ids the rule fired on (for the ground-truth check)


def log(rule: str, description: str, action: str, ids) -> None:
    ids = list(ids)
    touched[rule] = set(ids)
    rules.append({"rule": rule, "description": description, "action": action, "rows": len(ids)})


def main() -> None:
    raw = pd.read_csv(RAW, dtype=str, keep_default_na=False)
    assert list(raw.columns) == COLUMNS, "raw header differs from the HCL header"
    rows_in = len(raw)
    n_original = int((raw["customer_id"].str.strip().str.upper() <= "C00500").sum())  # for the report only
    df = raw.copy()

    # R1 exact duplicates (compare the raw text, before any fixing)
    dup = df.duplicated(keep="first")
    log("R1", "Exact duplicate rows (all 9 columns identical)", "dropped, first copy kept", df.loc[dup, "customer_id"])
    df = df[~dup].copy()

    # R2 text normalisation + empty string -> missing
    pre_region, pre_age = df["region"].copy(), df["age_group"].copy()  # text as it arrived
    for c in COLUMNS:
        df[c] = df[c].str.strip()
        df[c] = df[c].where(df[c] != "", np.nan)
    df["customer_id"] = df["customer_id"].str.upper()
    df["region"] = df["region"].str.title()
    fixed_region = df["customer_id"][(pre_region != "") & (pre_region != df["region"])]
    fixed_age = df["customer_id"][(pre_age != "") & (pre_age != df["age_group"])]
    log("R2a", "region text with wrong case or padding (north, ' South ', WEST)", "fixed: strip + Title Case", fixed_region)
    log("R2b", "age_group text with padding ('26-35 ')", "fixed: strip", fixed_age)

    # R3 churn_flag written as text
    cf = df["churn_flag"].str.lower().map(CHURN_TEXT)
    textual = df["churn_flag"].notna() & ~df["churn_flag"].isin(["0", "1"]) & cf.notna()
    log("R3", "churn_flag written as Yes/No/Y/N/true/false", "fixed: mapped to 1/0", df.loc[textual, "customer_id"])
    df["churn_flag"] = cf

    # R4 numeric columns: anything that is not a number becomes missing
    nonnum = []
    for c in NUMERIC:
        v = pd.to_numeric(df[c], errors="coerce")
        nonnum += list(df.loc[df[c].notna() & v.isna(), "customer_id"])
        df[c] = v
    log("R4", "non-numeric text in a numeric column", "set to missing (then rules below apply)", nonnum)

    # R5 categories outside the allowed list
    bad_age = df["age_group"].notna() & ~df["age_group"].isin(AGE_GROUPS)
    bad_reg = df["region"].notna() & ~df["region"].isin(REGIONS)
    log("R5", "age_group / region not in the allowed list (Unknown, N/A, ?)", "set to missing (imputed in R12)",
        list(df.loc[bad_age, "customer_id"]) + list(df.loc[bad_reg, "customer_id"]))
    df.loc[bad_age, "age_group"] = np.nan
    df.loc[bad_reg, "region"] = np.nan

    # R6 same customer_id twice with different content
    dup_id = df.duplicated("customer_id", keep="first")
    log("R6", "customer_id repeated with different content", "dropped, first row kept", df.loc[dup_id, "customer_id"])
    df = df[~dup_id].copy()

    # R7 no id or no churn label: the label is the thing we predict, so it is never invented
    r7 = df["customer_id"].isna() | df["churn_flag"].isna() | ~df["churn_flag"].isin([0, 1])
    log("R7", "missing customer_id or churn_flag (the target label)", "dropped", df.loc[r7, "customer_id"].fillna("(no id)"))
    df = df[~r7].copy()

    # R8 recency and frequency define the RFM segment, so they are never imputed
    r8 = df["last_purchase_days"].isna() | df["purchase_freq"].isna()
    log("R8", "missing last_purchase_days or purchase_freq (core RFM inputs)", "dropped", df.loc[r8, "customer_id"])
    df = df[~r8].copy()

    # R9 / R10 negative values
    neg_aov = df["avg_order_value"] < 0
    log("R9", "negative avg_order_value (sign-entry error)", "fixed: absolute value (assumption: only the sign is wrong)",
        df.loc[neg_aov, "customer_id"])
    df.loc[neg_aov, "avg_order_value"] = df.loc[neg_aov, "avg_order_value"].abs()
    neg_pts = df["loyalty_points"] < 0
    log("R10", "negative loyalty_points (points cannot be below zero)", "set to missing (imputed in R12)",
        df.loc[neg_pts, "customer_id"])
    df.loc[neg_pts, "loyalty_points"] = np.nan

    # R11 out of range: the true value is unknown, so the row cannot be trusted
    bad_rec = ~df["last_purchase_days"].between(*RECENCY_RANGE)
    log("R11a", f"last_purchase_days outside {RECENCY_RANGE[0]}-{RECENCY_RANGE[1]}", "dropped", df.loc[bad_rec, "customer_id"])
    df = df[~bad_rec].copy()
    bad_freq = ~df["purchase_freq"].between(*FREQ_RANGE)
    log("R11b", f"purchase_freq outside {FREQ_RANGE[0]}-{FREQ_RANGE[1]}", "dropped", df.loc[bad_freq, "customer_id"])
    df = df[~bad_freq].copy()
    bad_aov = df["avg_order_value"].notna() & ~df["avg_order_value"].between(*AOV_RANGE)
    log("R11c", f"avg_order_value outside {AOV_RANGE[0]:.0f}-{AOV_RANGE[1]:.0f} INR (decimal slip)", "dropped", df.loc[bad_aov, "customer_id"])
    df = df[~bad_aov].copy()
    bad_pts = df["loyalty_points"].notna() & (df["loyalty_points"] > POINTS_RANGE[1])
    log("R11d", f"loyalty_points above {POINTS_RANGE[1]}", "dropped", df.loc[bad_pts, "customer_id"])
    df = df[~bad_pts].copy()

    # R12 imputation (only for fields that are not part of the segment rule or the label)
    imputed = {}
    for c in ["age_group", "region"]:
        miss = df[c].isna()
        mode = df[c].mode()[0]
        imputed[c] = (mode, list(df.loc[miss, "customer_id"]))
        df.loc[miss, c] = mode
    for c, rounding in [("avg_order_value", 2), ("loyalty_points", 0)]:
        miss = df[c].isna()
        med = round(float(df[c].median()), rounding)
        imputed[c] = (med, list(df.loc[miss, "customer_id"]))
        df.loc[miss, c] = med
    for c, (value, ids) in imputed.items():
        kind = "mode" if c in ("age_group", "region") else "median"
        log(f"R12-{c}", f"missing {c}", f"imputed with the {kind} ({value})", ids)

    # (not a row rule) enforce dtypes, 2-decimals money, exact column order
    df["purchase_freq"] = df["purchase_freq"].astype(int)
    df["last_purchase_days"] = df["last_purchase_days"].astype(int)
    df["loyalty_points"] = df["loyalty_points"].round().astype(int)
    df["churn_flag"] = df["churn_flag"].astype(int)
    df["avg_order_value"] = df["avg_order_value"].astype(float).round(2)
    given_segment = df["rfm_segment"].copy()
    df = df.reset_index(drop=True)
    given_segment = given_segment.reset_index(drop=True)

    # R13 rfm_segment: recompute with the shared rule over the cleaned rows (quintiles over this data)
    new_segment = rfm_segments(df)
    is_orig = df["customer_id"] <= "C00500"
    agree = (new_segment == given_segment)
    log("R13", "rfm_segment recomputed with the shared RFM rule", "replaced (labels HCL supplied do not follow the rule)",
        df.loc[~agree, "customer_id"])
    df["rfm_segment"] = new_segment
    df = df[COLUMNS]

    # ---- final contract ----------------------------------------------------------------------
    assert list(df.columns) == COLUMNS
    assert df.isna().sum().sum() == 0, "nulls left"
    assert df["customer_id"].is_unique, "duplicate ids left"
    assert df["purchase_freq"].between(*FREQ_RANGE).all()
    assert df["last_purchase_days"].between(*RECENCY_RANGE).all()
    assert df["avg_order_value"].between(*AOV_RANGE).all()
    assert df["loyalty_points"].between(*POINTS_RANGE).all()
    assert set(df["churn_flag"]) <= {0, 1}
    assert set(df["age_group"]) <= set(AGE_GROUPS) and set(df["region"]) <= set(REGIONS)
    assert set(df["rfm_segment"]) <= {"Champion", "Loyal", "At_Risk", "Lost", "New"}
    assert 4850 <= len(df) <= 5000, f"unexpected row count {len(df)}"

    out = df.copy()
    out["avg_order_value"] = out["avg_order_value"].map(lambda v: f"{v:.2f}")
    out.to_csv(OUT, index=False, lineterminator="\n")
    FRONTEND_COPY.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(OUT, FRONTEND_COPY)

    write_report(rows_in, n_original, df, is_orig, given_segment, new_segment)
    write_dictionary(df)
    print(f"rows in  : {rows_in}\nrows out : {len(df)}  (dropped {rows_in - len(df)})")
    for r in rules:
        print(f"  {r['rule']:<14}{r['rows']:>5}  {r['description']}  -> {r['action']}")
    print(f"churn rate: {df.churn_flag.mean():.2%}")
    print(f"wrote {OUT}\nwrote {FRONTEND_COPY}\nwrote {REPORT}")


def write_report(rows_in, n_original, df, is_orig, given, new) -> None:
    rows_out = len(df)
    lines = [
        "# Cleaning report",
        "",
        "Produced by `analysis/clean_dataset.py` from `data/dataset_raw_combined.csv`. Re-running the script rewrites this file.",
        "",
        "## Summary",
        "",
        "| Item | Value |",
        "|---|---|",
        f"| Rows in (raw combined file) | {rows_in:,} |",
        f"|   of which HCL original rows | {n_original:,} |",
        f"|   of which generated rows (incl. duplicate copies) | {rows_in - n_original:,} |",
        f"| Rows out (`data/dataset.csv`) | {rows_out:,} |",
        f"| Rows removed | {rows_in - rows_out:,} ({(rows_in - rows_out) / rows_in:.2%}) |",
        f"| Churn rate after cleaning | {df.churn_flag.mean():.2%} ({int(df.churn_flag.sum()):,} of {rows_out:,}) |",
        "| Nulls after cleaning | 0 |",
        "| Unique customer_id | yes |",
        "",
        "## Rules, in the order they run",
        "",
        "A row is counted under the first rule that fires on it. Rules that fix or impute keep the row.",
        "",
        "| Rule | What is wrong | Action | Rows |",
        "|---|---|---|---:|",
    ]
    for r in rules:
        lines.append(f"| {r['rule']} | {r['description']} | {r['action']} | {r['rows']:,} |")

    lines += [
        "",
        "Why these choices:",
        "",
        "- The churn label and the two inputs of the RFM rule (recency, frequency) are never imputed. An invented label would train the model on made-up answers, and an invented recency would move a customer into the wrong segment.",
        "- Average order value and loyalty points are imputed with the median, categories with the mode. These fields do not decide the segment or the label, and the median is not pulled by outliers.",
        "- A negative order value is read as a sign error and made positive. This is an assumption; the other option is to drop the row, which would remove 12 more rows out of about 5,000.",
        "- Out-of-range values are dropped, not clipped, because clipping a recency of 900 to 365 would claim knowledge we do not have.",
        "- Valid ranges: purchase_freq 1-48, avg_order_value 100-25,000 INR, last_purchase_days 1-365, loyalty_points 0-9,999. They come from the HCL file (observed 1-48, 266-19,904, 1-365, 38-9,997) with a little slack on order value.",
        "",
        "## rfm_segment: why it was recomputed (R13)",
        "",
    ]
    orig_agree = float((new[is_orig] == given[is_orig]).mean())
    gen_agree = float((new[~is_orig] == given[~is_orig]).mean())
    alone = rfm_segments(df[is_orig])  # the rule applied to the 500 original rows by themselves
    orig_alone = float((alone == given[is_orig]).mean())
    lines += [
        "The shared RFM rule gives each customer a score from 1 to 5 on recency, frequency and spend (quintiles) and maps the scores to a segment. The segment labels in HCL's file do not follow that rule:",
        "",
        f"- HCL original rows, rule applied to the 500 rows alone: **{orig_alone:.1%}** of the given labels match (random labels would match about 20%).",
        f"- HCL original rows, rule applied over all {len(df):,} cleaned rows: {orig_agree:.1%} match.",
        f"- Generated rows: {gen_agree:.1%} keep their label. The other {1 - gen_agree:.1%} change because the quintile cut-offs move when the 500 original rows (recency spread evenly over 1-365 days) join the data.",
        "",
        "The React app computes the segment with the same rule on whatever rows it loads, so the CSV now carries the same value the app shows. The original labels are kept in `data/dataset_original.csv`.",
        "",
        "## Check against the injected faults (`anomaly_labels.csv`)",
        "",
        "The cleaner never reads the labels while cleaning. After it finishes, this table asks: for every fault the generator injected, did the rule that should catch it fire on that customer_id?",
        "",
        "| Fault injected | Column | Injected | Caught by | Caught | Outcome |",
        "|---|---|---:|---|---:|---|",
    ]
    expected = {
        ("duplicate_row", "*"): ("R1", "removed"),
        ("missing_value", "age_group"): ("R12-age_group", "imputed"),
        ("missing_value", "region"): ("R12-region", "imputed"),
        ("missing_value", "avg_order_value"): ("R12-avg_order_value", "imputed"),
        ("missing_value", "loyalty_points"): ("R12-loyalty_points", "imputed"),
        ("missing_value", "last_purchase_days"): ("R8", "row removed"),
        ("missing_value", "churn_flag"): ("R7", "row removed"),
        ("negative_value", "avg_order_value"): ("R9", "fixed"),
        ("negative_value", "loyalty_points"): ("R12-loyalty_points", "imputed"),
        ("out_of_range", "last_purchase_days"): ("R11a", "row removed"),
        ("out_of_range", "purchase_freq"): ("R11b", "row removed"),
        ("out_of_range", "avg_order_value"): ("R11c", "row removed"),
        ("format_inconsistency", "region"): ("R2a", "fixed"),
        ("format_inconsistency", "age_group"): ("R2b", "fixed"),
        ("format_inconsistency", "churn_flag"): ("R3", "fixed"),
        ("invalid_category", "age_group"): ("R12-age_group", "imputed"),
    }
    labels = pd.read_csv(LABELS, dtype=str, keep_default_na=False)
    total = caught_total = 0
    for (ft, col), grp in labels.groupby(["fault_type", "column"], sort=False):
        rule, outcome = expected[(ft, col)]
        ids = set(grp["customer_id"])
        caught = len(ids & touched[rule])
        total += len(ids)
        caught_total += caught
        lines.append(f"| {ft} | {col} | {len(ids)} | {rule} | {caught} | {outcome} |")
    lines += [
        "",
        f"Total: {caught_total} of {total} injected faults caught by the expected rule ({caught_total / total:.1%}).",
        "",
        "Note on limits: this check only covers faults the generator can label. A wrong value that still lies inside the valid range (for example an order value of 9,000 typed as 900) passes every rule. Range checks cannot find those, and the report says so instead of claiming the file is perfect.",
        "",
        "## Profile of the cleaned file",
        "",
        "| Column | dtype | min | max | distinct |",
        "|---|---|---:|---:|---:|",
    ]
    for c in COLUMNS:
        s = df[c]
        if pd.api.types.is_numeric_dtype(s):
            lines.append(f"| {c} | {s.dtype} | {s.min():g} | {s.max():g} | {s.nunique():,} |")
        else:
            lines.append(f"| {c} | {'string'} | - | - | {s.nunique():,} |")
    lines += ["", "Segment counts: " + ", ".join(f"{k} {v:,}" for k, v in df.rfm_segment.value_counts().items()) + ".", ""]
    REPORT.write_text("\n".join(lines), encoding="utf-8")

DESCRIPTIONS = {
    "customer_id": ("string", "Anonymised customer key: the letter C and five digits (C00001 to C05000). It is unique per row and is not linked to a name, phone number or email, so it is not personal data on its own."),
    "age_group": ("category", "Age band of the customer: 18-25, 26-35, 36-45, 46-55 or 55+. A band is stored instead of the exact age to protect privacy."),
    "region": ("category", "Sales region of the customer's registered address: North, South, East, West or Central."),
    "purchase_freq": ("int", "Number of purchases (orders) the customer made in the observation period. Whole number from 1 to 48. This is the Frequency input of RFM."),
    "avg_order_value": ("float", "Average value of one order in Indian rupees (INR), 2 decimals, between 100 and 25,000. Monetary value in RFM is purchase_freq multiplied by avg_order_value."),
    "last_purchase_days": ("int", "Days since the customer's last purchase, counted at the snapshot date. Whole number from 1 to 365; lower means more recent. This is the Recency input of RFM."),
    "loyalty_points": ("int", "Current loyalty points balance, whole number from 0 to 9,999. In the generated rows it is about 1 point per INR 100 spent; HCL's original rows do not follow that relation."),
    "churn_flag": ("int", "1 if the customer has stopped buying (churned), 0 if still active. This is the label the churn model predicts. About 15% of rows are 1."),
    "rfm_segment": ("category", "Customer segment from the shared RFM rule: quintile scores 1-5 for recency, frequency and spend, then Champion (R>=4 and F>=4), Loyal, New, At_Risk or Lost. Recomputed over the cleaned rows, so it matches the segment the app shows."),
}


def write_dictionary(df: pd.DataFrame) -> None:
    """Same column layout as HCL's data_dictionary_original.csv, last column renamed to 'description'."""
    samples = df.head(3).copy()
    samples["avg_order_value"] = samples["avg_order_value"].map(lambda v: f"{v:.2f}")
    rows = []
    for c in COLUMNS:
        dtype, text = DESCRIPTIONS[c]
        rows.append([c, dtype, *samples[c].astype(str).tolist(), "No", text])
    pd.DataFrame(rows, columns=["column_name", "data_type", "sample_value_1", "sample_value_2", "sample_value_3",
                                "nullable", "description"]).to_csv(DICTIONARY, index=False, lineterminator="\n")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()

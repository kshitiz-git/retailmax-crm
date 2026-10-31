"""Generate 4,500 synthetic CRM rows and combine them with the 500 HCL rows.

Why this exists: HCL's dataset_original.csv (500 rows) is statistically random, so a churn model
cannot learn from it. HCL's own brief allows extra rows ("generate additional rows ... if needed",
20,000 suggested, 4,500 extra to reach 5,000). This script builds those rows with realistic,
correlated patterns, then injects labelled data-quality faults into a RAW file so that
clean_dataset.py has real work to do.

Outputs (all deterministic, seed 42):
    data/dataset_raw_combined.csv   500 original + 4,500 generated + injected faults
    data/anomaly_labels.csv         customer_id, fault_type, column, raw_value (ground truth)

Run:  python analysis/generate_dataset.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

SEED = 42
N_GENERATED = 4500
TARGET_CHURN = 0.15

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

COLUMNS = [
    "customer_id", "age_group", "region", "purchase_freq", "avg_order_value",
    "last_purchase_days", "loyalty_points", "churn_flag", "rfm_segment",
]
AGE_GROUPS = ["18-25", "26-35", "36-45", "46-55", "55+"]
REGIONS = ["North", "South", "East", "West", "Central"]

# Valid ranges (taken from the HCL file, widened slightly). clean_dataset.py enforces the same.
FREQ_RANGE = (1, 48)
AOV_RANGE = (100.0, 25000.0)
RECENCY_RANGE = (1, 365)
POINTS_RANGE = (0, 9999)

# ---- shared RFM rule (the React app implements the identical rule) ---------------------------


def rfm_scores(df: pd.DataFrame) -> pd.DataFrame:
    """Quintile scores 1-5. 5 = best (most recent, most frequent, highest spend).

    pandas qcut on rank(method='first') so ties are broken by row order, exactly like the
    TypeScript quintileScores() in src/lib/data/derive.ts.
    """
    monetary = df["purchase_freq"] * df["avg_order_value"]
    r = pd.qcut(df["last_purchase_days"].rank(method="first"), 5, labels=[5, 4, 3, 2, 1])
    f = pd.qcut(df["purchase_freq"].rank(method="first"), 5, labels=[1, 2, 3, 4, 5])
    m = pd.qcut(monetary.rank(method="first"), 5, labels=[1, 2, 3, 4, 5])
    return pd.DataFrame({"R": r.astype(int), "F": f.astype(int), "M": m.astype(int)}, index=df.index)


def segment_for(r: int, f: int) -> str:
    if r >= 4 and f >= 4:
        return "Champion"
    if f >= 3 and r >= 3:
        return "Loyal"
    if r >= 4 and f <= 2:
        return "New"
    if r <= 2 and f >= 3:
        return "At_Risk"
    if r <= 2 and f <= 2:
        return "Lost"
    return "At_Risk"  # r == 3 and f <= 2


def rfm_segments(df: pd.DataFrame) -> pd.Series:
    s = rfm_scores(df)
    return pd.Series([segment_for(r, f) for r, f in zip(s["R"], s["F"])], index=df.index, name="rfm_segment")


# ---- latent customer types -------------------------------------------------------------------
# Each hidden type fixes a joint pattern of frequency, recency and order value. The type itself is
# never written to the file; only its footprint is. weight = share of customers.
TYPES = {
    #  name         weight  freq(mean, sd)  recency generator            AOV(median, sigma)
    "champion":    dict(w=0.16, freq=(34, 7),  rec=("exp", 20, 90),     aov=(11000, 0.35)),
    "regular":     dict(w=0.28, freq=(22, 6),  rec=("exp", 55, 200),    aov=(8000, 0.45)),
    "new":         dict(w=0.15, freq=(4, 2.5), rec=("exp", 20, 75),     aov=(6500, 0.50)),
    "occasional":  dict(w=0.17, freq=(8, 3.5), rec=("uni", 30, 260),    aov=(4500, 0.55)),
    "slipping":    dict(w=0.13, freq=(20, 7),  rec=("uni", 130, 300),   aov=(9000, 0.40)),
    "lapsed":      dict(w=0.11, freq=(9, 5),   rec=("uni", 240, 365),   aov=(6000, 0.50)),
}
AGE_P = [0.18, 0.30, 0.24, 0.17, 0.11]
REGION_P = [0.24, 0.22, 0.16, 0.26, 0.12]
REGION_AOV = {"North": 1.00, "South": 1.05, "East": 0.92, "West": 1.08, "Central": 0.88}
# churn effects on the log-odds scale (younger customers leave a little more often)
AGE_CHURN = {"18-25": 0.30, "26-35": 0.10, "36-45": 0.0, "46-55": -0.10, "55+": -0.15}
REGION_CHURN = {"North": 0.0, "South": -0.10, "East": 0.15, "West": 0.05, "Central": 0.10}


def _recency(kind: tuple, n: int, rng: np.random.Generator) -> np.ndarray:
    how, a, b = kind
    if how == "exp":  # mostly recent, long right tail, capped at b
        return np.minimum(1 + rng.exponential(a, n), b)
    return rng.uniform(a, b, n)


def generate_clean_rows(rng: np.random.Generator, n: int = N_GENERATED, start_id: int = 501) -> pd.DataFrame:
    names = list(TYPES)
    types = rng.choice(names, size=n, p=[TYPES[k]["w"] for k in names])
    age = rng.choice(AGE_GROUPS, size=n, p=AGE_P)
    region = rng.choice(REGIONS, size=n, p=REGION_P)

    freq = np.zeros(n)
    rec = np.zeros(n)
    aov = np.zeros(n)
    for k, spec in TYPES.items():
        idx = np.where(types == k)[0]
        m = len(idx)
        freq[idx] = rng.normal(*spec["freq"], m)
        rec[idx] = _recency(spec["rec"], m, rng)
        aov[idx] = rng.lognormal(np.log(spec["aov"][0]), spec["aov"][1], m)
    aov = aov * np.array([REGION_AOV[r] for r in region])

    freq = np.clip(np.rint(freq), *FREQ_RANGE).astype(int)
    rec = np.clip(np.rint(rec), *RECENCY_RANGE).astype(int)
    aov = np.round(np.clip(aov, 266.0, 19950.0), 2)

    # loyalty points ~ lifetime spend / 100 with multiplicative noise, capped at the 4-digit maximum
    monetary = freq * aov
    points = np.rint(monetary / 100.0 * rng.lognormal(0.0, 0.25, n))
    points = np.clip(points, 10, POINTS_RANGE[1]).astype(int)

    df = pd.DataFrame({
        "customer_id": [f"C{start_id + i:05d}" for i in range(n)],
        "age_group": age,
        "region": region,
        "purchase_freq": freq,
        "avg_order_value": aov,
        "last_purchase_days": rec,
        "loyalty_points": points,
    })

    # churn: more likely when recency is high and frequency / spend are low; plus a small age and
    # region effect, a cliff after ~250 days, and unobserved noise so the task is not trivial.
    z = lambda s: (s - s.mean()) / s.std()
    logit = (
        1.10 * z(df["last_purchase_days"])
        - 0.75 * z(df["purchase_freq"])
        - 0.20 * z(np.log(df["avg_order_value"]))
        + 0.60 * (df["last_purchase_days"] > 250)
        + df["age_group"].map(AGE_CHURN)
        + df["region"].map(REGION_CHURN)
        + rng.normal(0, 0.90, n)
    ).to_numpy()
    lo, hi = -15.0, 5.0  # bisection on the intercept so that mean(p) == TARGET_CHURN
    for _ in range(60):
        mid = (lo + hi) / 2
        if (1 / (1 + np.exp(-(logit + mid)))).mean() < TARGET_CHURN:
            lo = mid
        else:
            hi = mid
    p = 1 / (1 + np.exp(-(logit + (lo + hi) / 2)))
    df["churn_flag"] = (rng.random(n) < p).astype(int)
    df["rfm_segment"] = rfm_segments(df)
    return df[COLUMNS]


# ---- fault injection -------------------------------------------------------------------------
FAULT_PLAN = [
    # (fault_type, column, count)
    ("duplicate_row", "*", 20),
    ("missing_value", "age_group", 8),
    ("missing_value", "region", 8),
    ("missing_value", "avg_order_value", 10),
    ("missing_value", "loyalty_points", 8),
    ("missing_value", "last_purchase_days", 5),
    ("missing_value", "churn_flag", 6),
    ("negative_value", "avg_order_value", 12),
    ("negative_value", "loyalty_points", 6),
    ("out_of_range", "last_purchase_days", 14),
    ("out_of_range", "purchase_freq", 8),
    ("out_of_range", "avg_order_value", 6),
    ("format_inconsistency", "region", 8),
    ("format_inconsistency", "age_group", 6),
    ("format_inconsistency", "churn_flag", 6),
    ("invalid_category", "age_group", 4),
]


def inject_faults(gen: pd.DataFrame, rng: np.random.Generator) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return (raw generated rows incl. duplicates, anomaly label table). Each fault hits its own row."""
    raw = gen.astype(object).copy()
    need = sum(c for _, _, c in FAULT_PLAN)
    victims = list(rng.choice(len(raw), size=need, replace=False))
    labels = []
    dup_src = []

    for fault, col, count in FAULT_PLAN:
        for _ in range(count):
            i = victims.pop()
            cid = raw.iat[i, 0]
            if fault == "duplicate_row":
                dup_src.append(i)
                labels.append((cid, fault, "*", "exact copy of an existing row"))
                continue
            old = raw.at[raw.index[i], col]
            if fault == "missing_value":
                new = np.nan
            elif fault == "negative_value":
                new = -old
            elif fault == "out_of_range":
                if col == "last_purchase_days":
                    new = int(rng.choice([0, -int(rng.integers(1, 30)), int(rng.integers(366, 1000))]))
                elif col == "purchase_freq":
                    new = int(rng.choice([0, -int(rng.integers(1, 5)), int(rng.integers(120, 400))]))
                else:  # decimal slip: x10 or x100
                    new = round(float(old) * float(rng.choice([10, 100])), 2)
                    new = max(new, 30000.0)
            elif fault == "format_inconsistency":
                if col == "churn_flag":
                    new = (("Yes", "Y", "true") if old == 1 else ("No", "N", "false"))[int(rng.integers(0, 3))]
                else:
                    s = str(old)
                    new = [s.lower(), s.upper(), f" {s} ", f"{s} "][int(rng.integers(0, 4))]
                    if new == s:  # lower()/upper() can be a no-op for '26-35'; force a visible fault
                        new = f" {s} "
            else:  # invalid_category
                new = str(rng.choice(["Unknown", "N/A", "Other", "?"]))
            raw.at[raw.index[i], col] = new
            labels.append((cid, fault, col, "" if (isinstance(new, float) and np.isnan(new)) else str(new)))

    # duplicates: every fault got its own row, so a duplicate source row carries no other fault and
    # its copy is an exact clone of a clean row. The copy is placed right after its source.
    dups = raw.iloc[dup_src].copy()
    raw["_pos"] = np.arange(len(raw), dtype=float)
    dups["_pos"] = np.array(dup_src, dtype=float) + 0.5  # slot right after the source row
    raw = pd.concat([raw, dups]).sort_values("_pos", kind="stable").drop(columns="_pos").reset_index(drop=True)
    return raw, pd.DataFrame(labels, columns=["customer_id", "fault_type", "column", "raw_value"])


def main() -> None:
    rng = np.random.default_rng(SEED)
    original = pd.read_csv(DATA / "dataset_original.csv")
    assert list(original.columns) == COLUMNS, "unexpected original header"

    gen = generate_clean_rows(rng)
    raw_gen, labels = inject_faults(gen, rng)
    raw = pd.concat([original.astype(object), raw_gen], ignore_index=True)[COLUMNS]

    raw.to_csv(DATA / "dataset_raw_combined.csv", index=False, lineterminator="\n")
    labels.to_csv(DATA / "anomaly_labels.csv", index=False, lineterminator="\n")

    # ---- summary -----------------------------------------------------------------------------
    n_fault_rows = labels["customer_id"].nunique()
    print(f"seed={SEED}")
    print(f"original rows        : {len(original)}")
    print(f"generated rows (clean): {len(gen)}")
    print(f"raw combined rows    : {len(raw)} (includes {int((labels.fault_type == 'duplicate_row').sum())} duplicate copies)")
    print(f"labelled fault rows  : {n_fault_rows} = {n_fault_rows / (len(original) + len(gen)):.2%} of 5,000 rows")
    print(labels.groupby(["fault_type", "column"]).size().to_string())
    print(f"generated churn rate : {gen.churn_flag.mean():.3%}  (target {TARGET_CHURN:.0%})")
    print("generated segments   :", gen.rfm_segment.value_counts().to_dict())
    print(f"wrote {DATA / 'dataset_raw_combined.csv'}\nwrote {DATA / 'anomaly_labels.csv'}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()

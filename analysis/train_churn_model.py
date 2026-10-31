"""Train the churn model and export it as JSON for the browser.

Features: 4 numeric (standardised) + one-hot age_group + one-hot region.
rfm_segment is NOT a feature: it is computed from recency and frequency, so it would leak.

Models: LogisticRegression (class_weight='balanced', L2) and RandomForestClassifier.
Split: stratified 80/20, seed 42. The logistic regression is exported; the React app scores
p = sigmoid(intercept + sum(coef * z)) with z = (x - mean) / std for numbers and 0/1 for categories.

Also answers one question honestly: does HCL's original 500-row file contain any learnable signal?

Output: src/data/churn-model.json
Run:  python analysis/train_churn_model.py
"""
from __future__ import annotations

import json
import math
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import RepeatedStratifiedKFold, StratifiedKFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

SEED = 42
THRESHOLD = 0.5
ROOT = Path(__file__).resolve().parent.parent
DATA_CSV = ROOT / "data" / "dataset.csv"
MODEL_JSON = ROOT / "src" / "data" / "churn-model.json"

NUMERIC = ["purchase_freq", "avg_order_value", "last_purchase_days", "loyalty_points"]
CATEGORICAL = {
    "age_group": ["18-25", "26-35", "36-45", "46-55", "55+"],
    "region": ["Central", "East", "North", "South", "West"],
}
FEATURES = NUMERIC + list(CATEGORICAL)
TARGET = "churn_flag"


def make_pipeline(model) -> Pipeline:
    pre = ColumnTransformer([
        ("num", StandardScaler(), NUMERIC),
        ("cat", OneHotEncoder(categories=list(CATEGORICAL.values()), handle_unknown="ignore", sparse_output=False),
         list(CATEGORICAL)),
    ])
    return Pipeline([("pre", pre), ("model", model)])


def make_lr() -> Pipeline:
    # penalty is left at its default, which is L2
    return make_pipeline(LogisticRegression(class_weight="balanced", C=1.0, max_iter=2000, random_state=SEED))


def make_rf() -> Pipeline:
    return make_pipeline(RandomForestClassifier(n_estimators=300, min_samples_leaf=5, class_weight="balanced",
                                                random_state=SEED, n_jobs=1))


def score(y_true, p) -> tuple[dict, list]:
    pred = (p >= THRESHOLD).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true, pred, labels=[0, 1]).ravel()
    m = {
        "accuracy": accuracy_score(y_true, pred),
        "precision": precision_score(y_true, pred, zero_division=0),
        "recall": recall_score(y_true, pred, zero_division=0),
        "f1": f1_score(y_true, pred, zero_division=0),
        "roc_auc": roc_auc_score(y_true, p),
    }
    return {k: round(float(v), 4) for k, v in m.items()}, [[int(tn), int(fp)], [int(fn), int(tp)]]


def json_probability(model: dict, row: dict) -> float:
    """The exact maths the React app runs, in pure Python (no numpy, no sklearn)."""
    z = model["intercept"]
    for f, s in model["numeric"].items():
        z += model["coef"][f] * ((float(row[f]) - s["mean"]) / s["std"])
    for col in model["categorical"]:
        z += model["coef"].get(f"{col}={row[col]}", 0.0)
    return 1.0 / (1.0 + math.exp(-z))


def main() -> None:
    df = pd.read_csv(DATA_CSV)
    assert df[FEATURES + [TARGET]].notna().all().all()
    X, y = df[FEATURES], df[TARGET]
    X_tr, X_te, y_tr, y_te = train_test_split(X, y, test_size=0.2, stratify=y, random_state=SEED)
    print(f"rows {len(df)} | train {len(X_tr)} | test {len(X_te)} | churn rate {y.mean():.2%} (train {y_tr.mean():.2%}, test {y_te.mean():.2%})")

    lr, rf = make_lr().fit(X_tr, y_tr), make_rf().fit(X_tr, y_tr)
    p_lr, p_rf = lr.predict_proba(X_te)[:, 1], rf.predict_proba(X_te)[:, 1]
    m_lr, cm_lr = score(y_te, p_lr)
    m_rf, cm_rf = score(y_te, p_rf)
    base_acc = float(1 - y_te.mean())
    cv = cross_val_score(make_lr(), X_tr, y_tr, cv=StratifiedKFold(5, shuffle=True, random_state=SEED), scoring="roc_auc")

    # ---- does HCL's original file carry any signal? ------------------------------------------
    is_orig = (df["customer_id"] <= "C00500").to_numpy()
    orig, gen = df[is_orig], df[~is_orig]
    cv_orig = cross_val_score(make_lr(), orig[FEATURES], orig[TARGET], scoring="roc_auc",
                              cv=RepeatedStratifiedKFold(n_splits=5, n_repeats=10, random_state=SEED))
    auc_orig_cv = float(cv_orig.mean())
    # (a) the exported model on the original rows that sit in its test split
    te_orig = is_orig[X_te.index]
    auc_orig_test = roc_auc_score(y_te[te_orig], p_lr[te_orig])
    # (b) a model learned only from generated rows, applied to all 500 original rows (no overlap)
    gen_only = make_lr().fit(gen[FEATURES], gen[TARGET])
    auc_orig_transfer = roc_auc_score(orig[TARGET], gen_only.predict_proba(orig[FEATURES])[:, 1])
    auc_gen_cv = float(cross_val_score(make_lr(), gen[FEATURES], gen[TARGET], scoring="roc_auc",
                                       cv=StratifiedKFold(5, shuffle=True, random_state=SEED)).mean())

    # ---- export ------------------------------------------------------------------------------
    pre, clf = lr.named_steps["pre"], lr.named_steps["model"]
    scaler = pre.named_transformers_["num"]
    names = NUMERIC + [f"{c}={v}" for c, vals in CATEGORICAL.items() for v in vals]
    coefs = clf.coef_[0]
    assert len(names) == len(coefs)

    rf_imp = rf.named_steps["model"].feature_importances_
    imp_by_col: dict[str, float] = {c: 0.0 for c in FEATURES}
    for n, v in zip(names, rf_imp):
        imp_by_col[n.split("=")[0]] += float(v)
    importance = sorted(({"feature": k, "importance": round(v, 4)} for k, v in imp_by_col.items()),
                        key=lambda d: -d["importance"])

    comparison = [
        {"model": "Logistic Regression", **m_lr},
        {"model": "Random Forest", **m_rf},
    ]
    model = {
        "model": "logistic_regression",
        "trained_on_rows": int(len(X_tr)),
        "numeric": {f: {"mean": float(m), "std": float(s)} for f, m, s in zip(NUMERIC, scaler.mean_, scaler.scale_)},
        "categorical": {c: list(v) for c, v in CATEGORICAL.items()},
        "coef": {n: float(c) for n, c in zip(names, coefs)},
        "intercept": float(clf.intercept_[0]),
        "threshold": THRESHOLD,
        "metrics": {**m_lr, "confusion_matrix": cm_lr, "test_rows": int(len(X_te))},
        "comparison": comparison,
        "original_500_roc_auc": round(auc_orig_cv, 4),
        "feature_importance": importance,
        "trained_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }
    MODEL_JSON.parent.mkdir(parents=True, exist_ok=True)
    MODEL_JSON.write_text(json.dumps(model, indent=2), encoding="utf-8")

    # ---- self-check: re-score from the JSON FILE in pure Python, compare with sklearn ----------
    loaded = json.loads(MODEL_JSON.read_text(encoding="utf-8"))
    sample = X_te.sample(5, random_state=SEED)
    sk = lr.predict_proba(sample)[:, 1]
    for (idx, row), p_sk in zip(sample.iterrows(), sk):
        p_js = json_probability(loaded, row.to_dict())
        assert abs(p_js - p_sk) < 1e-6, f"row {idx}: json {p_js} vs sklearn {p_sk}"
        assert (p_js >= loaded["threshold"]) == bool(lr.predict(sample.loc[[idx]])[0]), "class decision differs"
    worst = max(abs(json_probability(loaded, r.to_dict()) - p) for (_, r), p in zip(X_te.iterrows(), p_lr))
    assert worst < 1e-6, f"max |json - sklearn| over the whole test set = {worst}"
    assert set(loaded["coef"]) == set(NUMERIC) | {f"{c}={v}" for c, vs in CATEGORICAL.items() for v in vs}

    # ---- print -------------------------------------------------------------------------------
    print(f"\nbaseline 'nobody churns' accuracy on test: {base_acc:.4f}")
    print(pd.DataFrame(comparison).to_string(index=False))
    print(f"confusion matrix LR [[TN FP][FN TP]]: {cm_lr}   RF: {cm_rf}")
    print(f"LR 5-fold CV ROC-AUC on the training split: {cv.mean():.4f} +/- {cv.std():.4f}")
    print("\nLR coefficients (standardised features; + pushes towards churn):")
    for n, c in sorted(zip(names, coefs), key=lambda t: -abs(t[1])):
        print(f"  {n:<24}{c:+.4f}")
    print(f"  {'intercept':<24}{clf.intercept_[0]:+.4f}")
    print("\nRF importance by column:", {d['feature']: d['importance'] for d in importance})
    print("\nSignal in HCL's original 500 rows:")
    print(f"  LR trained + 5x10 repeated CV on the 500 alone      ROC-AUC {auc_orig_cv:.4f} +/- {cv_orig.std():.4f}  <- exported as original_500_roc_auc")
    print(f"  exported LR on the {int(te_orig.sum())} original rows in its test split  ROC-AUC {auc_orig_test:.4f}")
    print(f"  LR learned from generated rows only, scored on all 500 ROC-AUC {auc_orig_transfer:.4f}")
    print(f"  same CV on the {len(gen)} generated rows                   ROC-AUC {auc_gen_cv:.4f}")
    print(f"\nself-check OK: 5 sampled rows and all {len(X_te)} test rows match sklearn (max diff {worst:.2e}, limit 1e-6)")
    print(f"wrote {MODEL_JSON}")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()

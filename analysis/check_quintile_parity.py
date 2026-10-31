"""Check that the app's quintile formula (src/lib/data/derive.ts, quintileScores) gives the same
1-5 scores as pandas.qcut(rank(method="first"), 5) used by this pipeline, for many row counts.

Run: .venv/Scripts/python analysis/check_quintile_parity.py   (exit code 1 on any difference)
"""
import sys

import pandas as pd


def app_scores(n: int) -> list[int]:
    """Port of quintileScores in derive.ts for ranks 1..n (higherIsBetter=True)."""
    out = []
    for pos in range(n):
        rank = pos + 1
        q = 5
        for k in range(1, 6):
            if rank <= 1 + (n - 1) * k / 5:
                q = k
                break
        out.append(q)
    return out


sizes = list(range(5, 400)) + list(range(4800, 5101))
bad = []
for n in sizes:
    ranks = pd.Series(range(n)).rank(method="first")
    pandas_scores = list(pd.qcut(ranks, 5, labels=[1, 2, 3, 4, 5]).astype(int))
    if pandas_scores != app_scores(n):
        bad.append(n)

print(f"row counts checked: {len(sizes)}, mismatches: {len(bad)} {bad[:10]}")
sys.exit(1 if bad else 0)

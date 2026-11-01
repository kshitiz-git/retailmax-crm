import { churnProbability, riskBand } from "@/lib/ml/churn";
import type { Customer, CustomerRow, LoyaltyTier, Segment } from "./types";

/**
 * Quintile score 1-5 per value, ranking with ties broken by input order
 * (same as pandas qcut on rank(method="first")). higherIsBetter=false flips it (recency).
 */
export function quintileScores(values: number[], higherIsBetter: boolean): number[] {
  const n = values.length;
  const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const scores = new Array<number>(n);
  // pandas.qcut(rank, 5) puts rank r (1..n) in the first bin k whose upper edge 1 + (n-1)*k/5
  // is >= r (edges are linear-interpolated quantiles of the ranks). Same here, so the browser
  // and analysis/clean_dataset.py always agree.
  order.forEach(([, i], pos) => {
    const rank = pos + 1;
    let q = 5;
    for (let k = 1; k <= 5; k++) {
      if (rank <= 1 + ((n - 1) * k) / 5) {
        q = k;
        break;
      }
    }
    scores[i] = higherIsBetter ? q : 6 - q; // 1 = lowest values
  });
  return scores;
}

/**
 * Shared RFM rule. The Python pipeline (analysis/generate_dataset.py) uses the identical rule.
 */
export function segmentFor(r: number, f: number): Segment {
  if (r >= 4 && f >= 4) return "Champion";
  if (f >= 3 && r >= 3) return "Loyal";
  if (r >= 4 && f <= 2) return "New";
  if (r <= 2 && f >= 3) return "At_Risk";
  if (r <= 2 && f <= 2) return "Lost";
  return "At_Risk";
}

/** Points thresholds for loyalty tiers (inclusive lower bound). */
export const TIER_THRESHOLDS: Record<LoyaltyTier, number> = {
  Bronze: 0,
  Silver: 2500,
  Gold: 5000,
  Platinum: 8000,
};

export function tierFor(points: number): LoyaltyTier {
  if (points >= TIER_THRESHOLDS.Platinum) return "Platinum";
  if (points >= TIER_THRESHOLDS.Gold) return "Gold";
  if (points >= TIER_THRESHOLDS.Silver) return "Silver";
  return "Bronze";
}

/** Deterministic 32-bit FNV-1a hash -> [0,1). Used for stable demo defaults. */
export function hashUnit(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 4294967296;
}

/**
 * Default marketing consent before anyone edits it: hash of the id below 0.78. On the delivered
 * 4,961 rows that is 4,040 opted in (81.4%; the hash is not perfectly uniform over sequential ids).
 * It is stable across reloads. Edited values live in the store and win over this.
 */
export function defaultConsent(id: string): boolean {
  return hashUnit(`consent:${id}`) < 0.78;
}

export function deriveCustomers(
  rows: CustomerRow[],
  pointsDelta: Record<string, number>,
  consent: Record<string, boolean>,
): Customer[] {
  const monetary = rows.map((r) => r.purchase_freq * r.avg_order_value);
  const R = quintileScores(rows.map((r) => r.last_purchase_days), false);
  const F = quintileScores(rows.map((r) => r.purchase_freq), true);
  const M = quintileScores(monetary, true);
  return rows.map((row, i) => {
    const r = R[i]!;
    const f = F[i]!;
    const m = M[i]!;
    const points = Math.max(0, row.loyalty_points + (pointsDelta[row.customer_id] ?? 0));
    const p = churnProbability(row);
    return {
      ...row,
      monetary: monetary[i]!,
      r,
      f,
      m,
      rfmScore: `${r}${f}${m}`,
      computedSegment: segmentFor(r, f),
      points,
      tier: tierFor(points),
      consent: consent[row.customer_id] ?? defaultConsent(row.customer_id),
      churnProb: p,
      riskBand: riskBand(p),
    };
  });
}

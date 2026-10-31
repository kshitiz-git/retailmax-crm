import {
  LOYALTY_TIERS,
  REGIONS,
  SEGMENTS,
  type Customer,
  type LoyaltyTier,
  type Region,
  type Segment,
} from "@/lib/data/types";
import { TIER_THRESHOLDS } from "@/lib/data/derive";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";

/* ------------------------------ Shared helpers ------------------------------ */

/** Days since last purchase that still counts as an active customer. */
export const ACTIVE_DAYS = 90;

/** "At_Risk" is stored; users see "At Risk". */
export const segLabel = (s: string) => s.replace(/_/g, " ");

/**
 * The dashboard and the funnel group customers by the segment the shared RFM rule
 * computes, so counts stay right after a CSV import.
 */
export const segmentOf = (c: Customer): Segment => c.computedSegment;

export const SEGMENT_COLOR: Record<Segment, string> = {
  Champion: "var(--chart-3)",
  Loyal: "var(--chart-1)",
  New: "var(--chart-2)",
  At_Risk: "var(--chart-4)",
  Lost: "var(--chart-5)",
};

export const TIER_COLOR: Record<LoyaltyTier, string> = {
  Bronze: "var(--chart-8)",
  Silver: "var(--chart-6)",
  Gold: "var(--chart-4)",
  Platinum: "var(--chart-1)",
};

export const ratio = (a: number, b: number) => (b ? a / b : 0);
/** a as a percentage of b (0 when b is 0). */
export const pctOf = (a: number, b: number) => ratio(a, b) * 100;
/** Percent difference of a group value against the whole (null when it cannot be compared). */
export const pctDiff = (group: number, all: number): number | null => (all ? (group / all - 1) * 100 : null);

/** Linear-interpolated quantile of an ascending-sorted array (same method as numpy's default). */
export function quantileSorted(sorted: ArrayLike<number>, q: number): number {
  const n = sorted.length;
  if (!n) return 0;
  const pos = (n - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.min(n - 1, lo + 1);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (pos - lo);
}

/* ------------------------------- Aggregation ------------------------------- */

export interface Agg {
  n: number;
  revenue: number;
  orders: number;
  churned: number;
  points: number;
  active: number;
}

export const blankAgg = (): Agg => ({ n: 0, revenue: 0, orders: 0, churned: 0, points: 0, active: 0 });

export function addToAgg(a: Agg, c: Customer) {
  a.n += 1;
  a.revenue += c.monetary;
  a.orders += c.purchase_freq;
  a.churned += c.churn_flag;
  a.points += c.points;
  if (c.last_purchase_days <= ACTIVE_DAYS) a.active += 1;
}

/** True average order value: revenue divided by orders, not the mean of per-customer averages. */
export const aovOf = (a: Agg) => ratio(a.revenue, a.orders);
export const churnPctOf = (a: Agg) => pctOf(a.churned, a.n);
export const avgPointsOf = (a: Agg) => ratio(a.points, a.n);
export const avgSpendOf = (a: Agg) => ratio(a.revenue, a.n);

/* ------------------------------- KPI chips ------------------------------- */

export interface TileChip {
  text: string;
  tone: "good" | "bad" | "neutral";
  direction?: "up" | "down";
}

/** "+12.3% Champions vs all". Returns undefined when the comparison is not possible. */
export function diffChip(
  label: string,
  diff: number | null,
  opts: { higherIsGood?: boolean; unit?: "%" | "pts" } = {},
): TileChip | undefined {
  if (diff === null || !Number.isFinite(diff)) return undefined;
  const { higherIsGood = true, unit = "%" } = opts;
  const abs = Math.abs(diff);
  if (abs < 0.05) return { text: `${label}: same as all`, tone: "neutral" };
  const up = diff > 0;
  const sign = up ? "+" : "−";
  return {
    text: `${sign}${abs.toFixed(1)}${unit === "%" ? "%" : " pts"} ${label}`,
    tone: up === higherIsGood ? "good" : "bad",
    direction: up ? "up" : "down",
  };
}

/* ------------------------------- Dashboard ------------------------------- */

/** Recency histogram: 30-day bins from 0, the last bin is open-ended (360+). */
export const RECENCY_BIN_DAYS = 30;
export const RECENCY_BINS = 13;

export function recencyLabel(i: number) {
  if (i >= RECENCY_BINS - 1) return `${(RECENCY_BINS - 1) * RECENCY_BIN_DAYS}+`;
  return `${i * RECENCY_BIN_DAYS}-${(i + 1) * RECENCY_BIN_DAYS - 1}`;
}

export interface DashboardData {
  n: number;
  all: Agg;
  active: Agg;
  consented: Agg;
  notConsented: Agg;
  highRisk: number;
  segments: Array<{ key: Segment; label: string; color: string; agg: Agg }>;
  regions: Array<{ key: Region; agg: Agg }>;
  tiers: Array<{ key: LoyaltyTier; n: number; color: string; from: number }>;
  recency: Array<{ label: string; value: number; color: string }>;
  medianDays: number;
  top: Customer[];
  attention: Customer[];
  /** Total spend of the customers in `attention`. */
  attentionSpend: number;
  totalPoints: number;
}

export function computeDashboard(customers: Customer[]): DashboardData {
  const all = blankAgg();
  const active = blankAgg();
  const consented = blankAgg();
  const notConsented = blankAgg();
  const bySeg = new Map<Segment, Agg>(SEGMENTS.map((s) => [s, blankAgg()]));
  const byRegion = new Map<Region, Agg>(REGIONS.map((r) => [r, blankAgg()]));
  const tierCount = new Map<LoyaltyTier, number>(LOYALTY_TIERS.map((t) => [t, 0]));
  const bins = new Array<number>(RECENCY_BINS).fill(0);
  const days = new Float64Array(customers.length);
  let highRisk = 0;
  let totalPoints = 0;

  customers.forEach((c, i) => {
    addToAgg(all, c);
    if (c.last_purchase_days <= ACTIVE_DAYS) addToAgg(active, c);
    addToAgg(c.consent ? consented : notConsented, c);
    const seg = bySeg.get(segmentOf(c));
    if (seg) addToAgg(seg, c);
    const reg = byRegion.get(c.region);
    if (reg) addToAgg(reg, c);
    tierCount.set(c.tier, (tierCount.get(c.tier) ?? 0) + 1);
    if (c.riskBand === "High") highRisk += 1;
    totalPoints += c.points;
    days[i] = c.last_purchase_days;
    const bin = Math.min(RECENCY_BINS - 1, Math.max(0, Math.floor(c.last_purchase_days / RECENCY_BIN_DAYS)));
    bins[bin] += 1;
  });

  days.sort();
  const activeBins = Math.ceil(ACTIVE_DAYS / RECENCY_BIN_DAYS);

  const top = [...customers].sort((a, b) => b.monetary - a.monetary).slice(0, 10);
  const attention = customers
    .filter((c) => {
      const s = segmentOf(c);
      return s === "Champion" || s === "Loyal";
    })
    .sort((a, b) => b.churnProb - a.churnProb)
    .slice(0, 8);

  return {
    n: customers.length,
    all,
    active,
    consented,
    notConsented,
    highRisk,
    segments: SEGMENTS.map((key) => ({ key, label: segLabel(key), color: SEGMENT_COLOR[key], agg: bySeg.get(key)! })),
    regions: REGIONS.map((key) => ({ key, agg: byRegion.get(key)! })),
    tiers: LOYALTY_TIERS.map((key) => ({
      key,
      n: tierCount.get(key) ?? 0,
      color: TIER_COLOR[key],
      from: TIER_THRESHOLDS[key],
    })),
    recency: bins.map((value, i) => ({
      label: recencyLabel(i),
      value,
      color: i < activeBins ? "var(--chart-3)" : i < activeBins + 3 ? "var(--chart-1)" : "var(--chart-4)",
    })),
    medianDays: quantileSorted(days, 0.5),
    top,
    attention,
    attentionSpend: attention.reduce((s, c) => s + c.monetary, 0),
    totalPoints,
  };
}

/** One computed sentence per panel. Every number comes from the data. */
export function dashboardInsights(d: DashboardData) {
  const segByShare = [...d.segments].sort((a, b) => b.agg.n - a.agg.n);
  const champion = d.segments.find((s) => s.key === "Champion")!;
  const topSeg = segByShare[0]!;

  const regionsRanked = [...d.regions].sort((a, b) => b.agg.revenue - a.agg.revenue);
  const topRegion = regionsRanked[0]!;
  const lowRegion = regionsRanked[regionsRanked.length - 1]!;

  const withCustomers = d.segments.filter((s) => s.agg.n > 0);
  const churnRanked = [...withCustomers].sort((a, b) => churnPctOf(b.agg) - churnPctOf(a.agg));
  const worstSeg = churnRanked[0];
  const bestSeg = churnRanked[churnRanked.length - 1];

  const topSpend = d.top.reduce((s, c) => s + c.monetary, 0);
  const upperTiers = d.tiers.filter((t) => t.key === "Gold" || t.key === "Platinum").reduce((s, t) => s + t.n, 0);

  return {
    segments: d.n
      ? champion.agg.n
        ? `Champions are ${formatPercent(pctOf(champion.agg.n, d.n), 0)} of customers and bring ${formatPercent(pctOf(champion.agg.revenue, d.all.revenue), 0)} of revenue.`
        : `${topSeg.label} is the largest segment at ${formatPercent(pctOf(topSeg.agg.n, d.n), 0)} of customers.`
      : "Import customers to see the segment mix.",
    region: d.all.revenue
      ? `${topRegion.key} brings ${formatPercent(pctOf(topRegion.agg.revenue, d.all.revenue), 0)} of revenue; ${lowRegion.key} brings the least at ${formatPercent(pctOf(lowRegion.agg.revenue, d.all.revenue), 0)}.`
      : "No revenue recorded yet.",
    churn:
      worstSeg && bestSeg
        ? `${worstSeg.label} customers churn most at ${formatPercent(churnPctOf(worstSeg.agg))}; ${bestSeg.label} customers churn least at ${formatPercent(churnPctOf(bestSeg.agg))}.`
        : "No churn data yet.",
    recency: d.n
      ? `${formatPercent(pctOf(d.active.n, d.n), 0)} bought in the last ${ACTIVE_DAYS} days. The typical customer last bought ${formatNumber(d.medianDays)} days ago.`
      : "No purchase dates yet.",
    tier: d.n
      ? `${formatPercent(pctOf(upperTiers, d.n), 0)} of customers hold Gold or Platinum status.`
      : "No loyalty balances yet.",
    top: d.all.revenue
      ? `The top 10 customers spend ${formatCurrency(topSpend)}, ${formatPercent(pctOf(topSpend, d.all.revenue))} of all revenue.`
      : "No revenue recorded yet.",
    attention: d.attention.length
      ? `${d.attention.length} Champion and Loyal customers look most likely to leave, with ${formatCurrency(d.attentionSpend)} of lifetime spend.`
      : "No Champion or Loyal customers to watch right now.",
  };
}

import { AGE_GROUPS, REGIONS, type AgeGroup, type Campaign, type Customer, type Region, type Segment } from "@/lib/data/types";
import { blankAgg, addToAgg, aovOf, quantileSorted, segmentOf, type Agg } from "./stats";

/* ---------------------------- Lifecycle funnel ---------------------------- */

/**
 * The dataset has purchases per customer, not visits or leads, so the funnel follows the
 * customer lifecycle. Each stage keeps only customers who passed every stage before it.
 */
export const REPEAT_MIN = 2;
export const REGULAR_MIN = 6;
export const FREQUENT_MIN = 12;
/** "High value" = total spend at or above this percentile of all customers. */
export const HIGH_VALUE_QUANTILE = 0.75;

export const FUNNEL_STAGES = [
  { key: "all", label: "All customers", short: "All" },
  { key: "repeat", label: `Repeat buyers (${REPEAT_MIN}+ orders)`, short: "Repeat" },
  { key: "regular", label: `Regular (${REGULAR_MIN}+ orders)`, short: "Regular" },
  { key: "frequent", label: `Frequent (${FREQUENT_MIN}+ orders)`, short: "Frequent" },
  { key: "high", label: "High value (top 25% spend)", short: "High value" },
  { key: "retained", label: "Retained (not churned)", short: "Retained" },
] as const;

export const STAGE_COUNT = FUNNEL_STAGES.length;

/** Spend cut-off for "High value", measured over every customer so it does not move with the filters. */
export function highValueCutoff(customers: Customer[]): number {
  const m = Float64Array.from(customers, (c) => c.monetary);
  m.sort();
  return quantileSorted(m, HIGH_VALUE_QUANTILE);
}

/** How many customers reach each stage (one pass, nested stages). */
export function stageCounts(rows: Customer[], cutoff: number): number[] {
  const out = new Array<number>(STAGE_COUNT).fill(0);
  for (const c of rows) {
    out[0] += 1;
    if (c.purchase_freq < REPEAT_MIN) continue;
    out[1] += 1;
    if (c.purchase_freq < REGULAR_MIN) continue;
    out[2] += 1;
    if (c.purchase_freq < FREQUENT_MIN) continue;
    out[3] += 1;
    if (c.monetary < cutoff) continue;
    out[4] += 1;
    if (c.churn_flag === 1) continue;
    out[5] += 1;
  }
  return out;
}

export interface FunnelStep {
  key: string;
  stage: string;
  value: number;
  /** Share of the first stage, 1 decimal. Feeds FunnelPanel. */
  pct: number;
  /** Share lost against the previous stage, 1 decimal. Feeds FunnelPanel. */
  drop: number;
  /** Share kept against the previous stage. */
  conv: number;
  /** Customers lost against the previous stage. */
  lost: number;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

export function toSteps(counts: number[]): FunnelStep[] {
  const first = counts[0] ?? 0;
  return FUNNEL_STAGES.map((s, i) => {
    const value = counts[i] ?? 0;
    const prev = i === 0 ? value : (counts[i - 1] ?? 0);
    const conv = prev ? (value / prev) * 100 : 0;
    return {
      key: s.key,
      stage: s.label,
      value,
      pct: round1(first ? (value / first) * 100 : 0),
      drop: i === 0 || !prev ? 0 : round1(100 - conv),
      conv: round1(conv),
      lost: i === 0 ? 0 : prev - value,
    };
  });
}

/** The step (index >= 1) where the largest share of customers is lost. */
export function worstStep(steps: FunnelStep[]): FunnelStep | undefined {
  return steps.slice(1).reduce<FunnelStep | undefined>((w, s) => (!w || s.drop > w.drop ? s : w), undefined);
}

export interface FunnelFilters {
  region: Region | "all";
  age: AgeGroup | "all";
  segment: Segment | "all";
}

export const NO_FILTERS: FunnelFilters = { region: "all", age: "all", segment: "all" };

export const filtersActive = (f: FunnelFilters) => f.region !== "all" || f.age !== "all" || f.segment !== "all";

/** Customers matching age and segment (the region filter is applied separately, so the region table can show every region). */
export function filterBase(customers: Customer[], f: FunnelFilters): Customer[] {
  if (f.age === "all" && f.segment === "all") return customers;
  return customers.filter((c) => (f.age === "all" || c.age_group === f.age) && (f.segment === "all" || segmentOf(c) === f.segment));
}

export function stageCountsByRegion(rows: Customer[], cutoff: number): Array<{ region: Region; counts: number[] }> {
  const groups = new Map<Region, Customer[]>(REGIONS.map((r) => [r, []]));
  for (const c of rows) groups.get(c.region)?.push(c);
  return REGIONS.map((region) => ({ region, counts: stageCounts(groups.get(region) ?? [], cutoff) }));
}

/* ------------------------- Order value by age and frequency ------------------------- */

export const FREQ_BANDS = [
  { key: "1-5", min: 1, max: 5 },
  { key: "6-11", min: 6, max: 11 },
  { key: "12-23", min: 12, max: 23 },
  { key: "24+", min: 24, max: Infinity },
] as const;

export const bandOf = (freq: number) => (FREQ_BANDS.find((b) => freq >= b.min && freq <= b.max) ?? FREQ_BANDS[0]).key;

/** A band is only plotted when this many customers back it, so one buyer cannot set a bar. */
export const MIN_CELL = 3;

export interface AovCell {
  age: AgeGroup;
  band: string;
  agg: Agg;
  aov: number;
}

export function aovByAgeAndBand(rows: Customer[]): { cells: AovCell[]; byBand: Array<{ band: string; agg: Agg; aov: number }> } {
  const cells = new Map<string, Agg>();
  const bands = new Map<string, Agg>(FREQ_BANDS.map((b) => [b.key, blankAgg()]));
  for (const c of rows) {
    const band = bandOf(c.purchase_freq);
    const key = `${c.age_group}|${band}`;
    let a = cells.get(key);
    if (!a) cells.set(key, (a = blankAgg()));
    addToAgg(a, c);
    addToAgg(bands.get(band)!, c);
  }
  const out: AovCell[] = [];
  for (const age of AGE_GROUPS) {
    for (const b of FREQ_BANDS) {
      const agg = cells.get(`${age}|${b.key}`) ?? blankAgg();
      out.push({ age, band: b.key, agg, aov: aovOf(agg) });
    }
  }
  return { cells: out, byBand: FREQ_BANDS.map((b) => ({ band: b.key, agg: bands.get(b.key)!, aov: aovOf(bands.get(b.key)!) })) };
}

/* ------------------------------ Campaign funnel ------------------------------ */

export interface CampaignTotals {
  campaigns: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  revenue: number;
}

/** Totals over every campaign that has results (completed runs). */
export function campaignTotals(campaigns: Campaign[]): CampaignTotals {
  const t: CampaignTotals = { campaigns: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0, revenue: 0 };
  for (const c of campaigns) {
    const r = c.results;
    if (!r) continue;
    t.campaigns += 1;
    t.sent += r.sent;
    t.delivered += r.delivered;
    t.opened += r.opened;
    t.clicked += r.clicked;
    t.converted += r.converted;
    t.revenue += r.revenue;
  }
  return t;
}

export const CAMPAIGN_STAGES = ["Sent", "Delivered", "Opened", "Clicked", "Converted"] as const;

export function campaignSteps(t: CampaignTotals): Array<{ stage: string; value: number; drop: number; pct: number }> {
  const values = [t.sent, t.delivered, t.opened, t.clicked, t.converted];
  return CAMPAIGN_STAGES.map((stage, i) => {
    const prev = i === 0 ? values[0]! : values[i - 1]!;
    return {
      stage,
      value: values[i]!,
      pct: round1(t.sent ? (values[i]! / t.sent) * 100 : 0),
      drop: i === 0 || !prev ? 0 : round1(100 - (values[i]! / prev) * 100),
    };
  });
}

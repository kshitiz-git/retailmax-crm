import {
  AGE_GROUPS,
  LOYALTY_TIERS,
  REGIONS,
  SEGMENTS,
  type AgeGroup,
  type Customer,
  type LoyaltyTier,
  type Region,
  type RiskBand,
  type Segment,
} from "@/lib/data/types";

export const RISK_BANDS: readonly RiskBand[] = ["Low", "Medium", "High"];

export interface Filters {
  q: string;
  segment: Segment | "";
  region: Region | "";
  age: AgeGroup | "";
  tier: LoyaltyTier | "";
  risk: RiskBand | "";
  consent: "yes" | "no" | "";
}

export const EMPTY_FILTERS: Filters = { q: "", segment: "", region: "", age: "", tier: "", risk: "", consent: "" };

const norm = (s: string) => s.trim().toLowerCase().replace(/[\s_-]+/g, "_");

function pick<T extends string>(list: readonly T[], raw: string | null): T | "" {
  if (!raw) return "";
  const n = norm(raw);
  return list.find((x) => norm(x) === n) ?? "";
}

/**
 * Read filters from the URL. Unknown values are ignored (treated as "all"), so a stale or hand-typed
 * link never produces an empty page. "55+" arrives as "55 " when a link wrote a raw "+", so that is repaired.
 */
export function parseFilters(sp: URLSearchParams): Filters {
  const consent = norm(sp.get("consent") ?? "");
  const ageRaw = sp.get("age");
  return {
    q: sp.get("q") ?? "",
    segment: pick(SEGMENTS, sp.get("segment")),
    region: pick(REGIONS, sp.get("region")),
    age: pick(AGE_GROUPS, ageRaw ? ageRaw.replace(/ $/, "+") : null),
    tier: pick(LOYALTY_TIERS, sp.get("tier")),
    risk: pick(RISK_BANDS, sp.get("risk")),
    consent: ["yes", "true", "1", "granted"].includes(consent)
      ? "yes"
      : ["no", "false", "0", "none"].includes(consent)
        ? "no"
        : "",
  };
}

export const activeFilterCount = (f: Filters) => Object.values(f).filter((v) => v !== "").length;

export function applyFilters(list: Customer[], f: Filters): Customer[] {
  const q = f.q.trim().toLowerCase();
  const wantConsent = f.consent === "" ? null : f.consent === "yes";
  if (!q && !f.segment && !f.region && !f.age && !f.tier && !f.risk && wantConsent === null) return list;
  return list.filter(
    (c) =>
      (!f.segment || c.computedSegment === f.segment) &&
      (!f.region || c.region === f.region) &&
      (!f.age || c.age_group === f.age) &&
      (!f.tier || c.tier === f.tier) &&
      (!f.risk || c.riskBand === f.risk) &&
      (wantConsent === null || c.consent === wantConsent) &&
      (!q || c.customer_id.toLowerCase().includes(q)),
  );
}

export type SortKey =
  | "customer_id"
  | "segment"
  | "region"
  | "age"
  | "orders"
  | "aov"
  | "value"
  | "recency"
  | "points"
  | "tier"
  | "churn"
  | "consent";

export interface SortState {
  key: SortKey;
  dir: "asc" | "desc";
}

const collator = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

const COMPARE: Record<SortKey, (a: Customer, b: Customer) => number> = {
  customer_id: (a, b) => collator.compare(a.customer_id, b.customer_id),
  segment: (a, b) => SEGMENTS.indexOf(a.computedSegment) - SEGMENTS.indexOf(b.computedSegment),
  region: (a, b) => a.region.localeCompare(b.region),
  age: (a, b) => AGE_GROUPS.indexOf(a.age_group) - AGE_GROUPS.indexOf(b.age_group),
  orders: (a, b) => a.purchase_freq - b.purchase_freq,
  aov: (a, b) => a.avg_order_value - b.avg_order_value,
  value: (a, b) => a.monetary - b.monetary,
  recency: (a, b) => a.last_purchase_days - b.last_purchase_days,
  points: (a, b) => a.points - b.points,
  tier: (a, b) => LOYALTY_TIERS.indexOf(a.tier) - LOYALTY_TIERS.indexOf(b.tier),
  churn: (a, b) => a.churnProb - b.churnProb,
  consent: (a, b) => Number(a.consent) - Number(b.consent),
};

/** Stable sort on a copy; ties fall back to customer id so paging never reshuffles rows. */
export function sortCustomers(list: Customer[], { key, dir }: SortState): Customer[] {
  const cmp = COMPARE[key];
  const sign = dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => sign * cmp(a, b) || collator.compare(a.customer_id, b.customer_id));
}

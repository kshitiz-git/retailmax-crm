import type {
  CampaignChannel,
  CampaignResults,
  Customer,
  Segment,
} from "@/lib/data/types";

/**
 * Campaign simulation. There is no real messaging backend, so results are generated
 * from the consented audience with a seeded random stream (seed = campaign id + customer id).
 * The same campaign always produces the same numbers, on every reload.
 *
 * ---------------------------------------------------------------------------------------
 * SIMULATION ASSUMPTIONS. These rates are illustrative inputs for the demo, not measured
 * values. They follow the shape of typical retail benchmarks (WhatsApp and SMS are read more
 * often than email; engaged segments respond more than lapsed ones). Change them here and
 * every number in the Campaigns screen follows.
 * ---------------------------------------------------------------------------------------
 */

/** Share of sent messages that reach the customer, by channel. */
export const DELIVERY_RATE: Record<CampaignChannel, number> = {
  Email: 0.96,
  SMS: 0.98,
  WhatsApp: 0.97,
  Push: 0.9,
};

/** Share of delivered messages that are opened, before the segment adjustment. */
export const OPEN_RATE: Record<CampaignChannel, number> = {
  Email: 0.38,
  SMS: 0.6,
  WhatsApp: 0.75,
  Push: 0.28,
};

/** Share of opened messages that are clicked, before the segment adjustment. */
export const CLICK_RATE: Record<CampaignChannel, number> = {
  Email: 0.24,
  SMS: 0.2,
  WhatsApp: 0.32,
  Push: 0.22,
};

/** Segment engagement multiplier applied to open and click rates. Champions highest, Lost lowest. */
export const SEGMENT_ENGAGEMENT: Record<Segment, number> = {
  Champion: 1.2,
  Loyal: 1.08,
  New: 1.0,
  At_Risk: 0.78,
  Lost: 0.5,
};

/** Share of clickers who buy, by segment. */
export const CONVERT_RATE: Record<Segment, number> = {
  Champion: 0.42,
  Loyal: 0.34,
  New: 0.26,
  At_Risk: 0.18,
  Lost: 0.08,
};

/** Channel multiplier on the buy rate (a WhatsApp chat converts a little better than a push). */
export const CHANNEL_CONVERT_FACTOR: Record<CampaignChannel, number> = {
  Email: 1.0,
  SMS: 0.9,
  WhatsApp: 1.1,
  Push: 0.85,
};

/** Each 1% of discount lifts the buy rate by this fraction ("discount raises conversion slightly"). */
export const DISCOUNT_LIFT_PER_PCT = 0.006;

const MAX_RATE = 0.97;
const clamp = (v: number) => Math.min(MAX_RATE, Math.max(0, v));

export interface StageRates {
  delivery: number;
  open: number;
  click: number;
  convert: number;
}

export function stageRates(segment: Segment, channel: CampaignChannel, discountPct: number): StageRates {
  const eng = SEGMENT_ENGAGEMENT[segment];
  return {
    delivery: DELIVERY_RATE[channel],
    open: clamp(OPEN_RATE[channel] * eng),
    click: clamp(CLICK_RATE[channel] * eng),
    convert: clamp(
      CONVERT_RATE[segment] * CHANNEL_CONVERT_FACTOR[channel] * (1 + DISCOUNT_LIFT_PER_PCT * discountPct),
    ),
  };
}

/** Expected sent-to-converted rate for one segment. Used for the live revenue estimate in the wizard. */
export function expectedConversion(segment: Segment, channel: CampaignChannel, discountPct: number): number {
  const r = stageRates(segment, channel, discountPct);
  return r.delivery * r.open * r.click * r.convert;
}

/** Expected revenue for an audience: Σ P(convert) × AOV × (1 - discount). */
export function estimateRevenue(audience: readonly Customer[], channel: CampaignChannel, discountPct: number) {
  const keep = 1 - discountPct / 100;
  let converted = 0;
  let revenue = 0;
  for (const c of audience) {
    const p = expectedConversion(c.computedSegment, channel, discountPct);
    converted += p;
    revenue += p * c.avg_order_value * keep;
  }
  return { converted, revenue };
}

/** Loyalty points a converted customer earns: 1 point per ₹100 of order value, times the multiplier. */
export function pointsFor(customer: Pick<Customer, "avg_order_value">, multiplier: number) {
  return Math.round((customer.avg_order_value / 100) * multiplier);
}

/** Results plus the extra detail the detail sheet shows. Saved as `Campaign.results` (a superset of CampaignResults). */
export interface StoredResults extends CampaignResults {
  bySegment: Partial<Record<Segment, CampaignResults>>;
  pointsAwarded: number;
}

export interface SimulationOutcome {
  results: StoredResults;
  converted: Customer[];
  awards: Array<{ customerId: string; points: number }>;
}

/* ------------------------------ seeded random stream ------------------------------ */

function seedFrom(text: string): number {
  // FNV-1a, then the murmur3 finaliser so near-identical strings (C00041 vs C00042) become unrelated seeds.
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** mulberry32: small, fast, good-enough uniform stream in [0, 1). */
function stream(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const emptyResults = (): CampaignResults => ({ sent: 0, delivered: 0, opened: 0, clicked: 0, converted: 0, revenue: 0 });

export interface SimulationInput {
  /** Campaign id: the seed. */
  id: string;
  channel: CampaignChannel;
  discountPct: number;
  pointsMultiplier: number;
}

/**
 * Run the campaign over the CONSENTED audience only. Callers must filter out customers
 * without consent first (DPDP Act 2023): this function contacts everyone it is given.
 */
export function simulateCampaign(input: SimulationInput, consentedAudience: readonly Customer[]): SimulationOutcome {
  const total = emptyResults();
  const bySegment: Partial<Record<Segment, CampaignResults>> = {};
  const converted: Customer[] = [];
  const awards: Array<{ customerId: string; points: number }> = [];
  const keep = 1 - input.discountPct / 100;
  const rateCache = new Map<Segment, StageRates>();
  let pointsAwarded = 0;

  for (const c of consentedAudience) {
    const seg = c.computedSegment;
    let rates = rateCache.get(seg);
    if (!rates) {
      rates = stageRates(seg, input.channel, input.discountPct);
      rateCache.set(seg, rates);
    }
    const next = stream(seedFrom(`${input.id}|${c.customer_id}`));
    // Always draw all four numbers so one customer's outcome never depends on another stage's result.
    const uDeliver = next();
    const uOpen = next();
    const uClick = next();
    const uBuy = next();

    const bucket = (bySegment[seg] ??= emptyResults());
    total.sent++;
    bucket.sent++;
    if (uDeliver >= rates.delivery) continue;
    total.delivered++;
    bucket.delivered++;
    if (uOpen >= rates.open) continue;
    total.opened++;
    bucket.opened++;
    if (uClick >= rates.click) continue;
    total.clicked++;
    bucket.clicked++;
    if (uBuy >= rates.convert) continue;
    total.converted++;
    bucket.converted++;
    const revenue = c.avg_order_value * keep;
    total.revenue += revenue;
    bucket.revenue += revenue;
    converted.push(c);
    const points = pointsFor(c, input.pointsMultiplier);
    pointsAwarded += points;
    if (points > 0) awards.push({ customerId: c.customer_id, points });
  }

  total.revenue = Math.round(total.revenue);
  for (const b of Object.values(bySegment)) b.revenue = Math.round(b.revenue);

  return { results: { ...total, bySegment, pointsAwarded }, converted, awards };
}

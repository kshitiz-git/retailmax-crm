import type {
  AgeGroup,
  Campaign,
  CampaignChannel,
  Customer,
  Region,
  RiskBand,
  Segment,
} from "@/lib/data/types";
import { estimateRevenue } from "./simulate";

export interface AudienceFilters {
  segments: Segment[];
  regions: Region[];
  ageGroups: AgeGroup[];
  riskBands: RiskBand[];
}

/** An empty list means "any" for regions, age groups and risk bands. Segments are required by the wizard. */
export function matchesAudience(c: Customer, f: AudienceFilters): boolean {
  return (
    f.segments.includes(c.computedSegment) &&
    (f.regions.length === 0 || f.regions.includes(c.region)) &&
    (f.ageGroups.length === 0 || f.ageGroups.includes(c.age_group)) &&
    (f.riskBands.length === 0 || f.riskBands.includes(c.riskBand))
  );
}

export interface AudienceSummary {
  /** Everyone who matches the filters. */
  matching: number;
  /** Matching customers with marketing consent: the only ones a campaign may contact. */
  consented: Customer[];
  /** Matching customers left out because they have not given consent. */
  excluded: number;
  estConverted: number;
  estRevenue: number;
}

export function summarizeAudience(
  customers: readonly Customer[],
  filters: AudienceFilters,
  channel: CampaignChannel,
  discountPct: number,
): AudienceSummary {
  const consented: Customer[] = [];
  let matching = 0;
  for (const c of customers) {
    if (!matchesAudience(c, filters)) continue;
    matching++;
    if (c.consent) consented.push(c);
  }
  const est = estimateRevenue(consented, channel, discountPct);
  return {
    matching,
    consented,
    excluded: matching - consented.length,
    estConverted: est.converted,
    estRevenue: est.revenue,
  };
}

export const filtersOf = (c: Pick<Campaign, "segments" | "regions" | "ageGroups" | "riskBands">): AudienceFilters => ({
  segments: c.segments,
  regions: c.regions,
  ageGroups: c.ageGroups,
  riskBands: c.riskBands,
});

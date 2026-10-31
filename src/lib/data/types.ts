/** Exact column set of dataset.csv (HCL RetailMax brief). Order matters for CSV export. */
export const CSV_COLUMNS = [
  "customer_id",
  "age_group",
  "region",
  "purchase_freq",
  "avg_order_value",
  "last_purchase_days",
  "loyalty_points",
  "churn_flag",
  "rfm_segment",
] as const;

export const SEGMENTS = ["Champion", "Loyal", "New", "At_Risk", "Lost"] as const;
export type Segment = (typeof SEGMENTS)[number];

export const AGE_GROUPS = ["18-25", "26-35", "36-45", "46-55", "55+"] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export const REGIONS = ["North", "South", "East", "West", "Central"] as const;
export type Region = (typeof REGIONS)[number];

export const LOYALTY_TIERS = ["Bronze", "Silver", "Gold", "Platinum"] as const;
export type LoyaltyTier = (typeof LOYALTY_TIERS)[number];

export type RiskBand = "Low" | "Medium" | "High";

/** One raw row of dataset.csv, typed. */
export interface CustomerRow {
  customer_id: string;
  age_group: AgeGroup;
  region: Region;
  purchase_freq: number;
  avg_order_value: number;
  last_purchase_days: number;
  loyalty_points: number;
  churn_flag: 0 | 1;
  rfm_segment: Segment;
}

/** A row plus everything the CRM derives from it. */
export interface Customer extends CustomerRow {
  /** purchase_freq * avg_order_value (INR). */
  monetary: number;
  /** Quintile scores 1-5; R 5 = most recent. */
  r: number;
  f: number;
  m: number;
  /** e.g. "545". */
  rfmScore: string;
  /** Segment recomputed by the shared RFM rule (see derive.ts). */
  computedSegment: Segment;
  /** loyalty_points from the dataset plus every manual adjustment. */
  points: number;
  tier: LoyaltyTier;
  /** Marketing consent (DPDP Act 2023). Campaigns may only reach consented customers. */
  consent: boolean;
  /** Churn probability 0-1 from the in-browser logistic regression model. */
  churnProb: number;
  riskBand: RiskBand;
}

export interface LoyaltyTxn {
  id: string;
  customer_id: string;
  /** Positive = earned/credited, negative = redeemed/debited. */
  points: number;
  reason: string;
  at: string; // ISO timestamp
}

export interface ConsentEvent {
  id: string;
  customer_id: string;
  granted: boolean;
  source: string;
  at: string;
}

export interface Note {
  id: string;
  customer_id: string;
  text: string;
  at: string;
}

export type CampaignChannel = "Email" | "SMS" | "WhatsApp" | "Push";
export type CampaignStatus = "Draft" | "Scheduled" | "Running" | "Completed";

export interface CampaignResults {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  converted: number;
  revenue: number;
}

export interface Campaign {
  id: string;
  name: string;
  channel: CampaignChannel;
  segments: Segment[];
  regions: Region[];
  ageGroups: AgeGroup[];
  /** Only target customers whose churn risk band is in this list (empty = all). */
  riskBands: RiskBand[];
  offer: string;
  discountPct: number;
  pointsMultiplier: number;
  status: CampaignStatus;
  createdAt: string;
  scheduledFor?: string;
  /** Matching customers before the consent gate. */
  audienceSize: number;
  /** Matching customers who gave consent (the only ones contacted). */
  consentedSize: number;
  results?: CampaignResults;
}

export interface AuditEvent {
  id: string;
  at: string;
  action: string;
  detail: string;
}

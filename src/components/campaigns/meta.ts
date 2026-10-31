import { Bell, Crown, HandHeart, Mail, MessageCircle, MessageSquare, Sparkles, type LucideIcon } from "lucide-react";

import type {
  AgeGroup,
  Campaign,
  CampaignChannel,
  CampaignStatus,
  Region,
  RiskBand,
  Segment,
} from "@/lib/data/types";
import { SEGMENTS } from "@/lib/data/types";

/** "At_Risk" is stored with an underscore; users see "At Risk". */
export const segLabel = (s: string) => s.replace("_", " ");

export const CHANNELS: CampaignChannel[] = ["Email", "SMS", "WhatsApp", "Push"];
export const CHANNEL_ICON: Record<CampaignChannel, LucideIcon> = {
  Email: Mail,
  SMS: MessageSquare,
  WhatsApp: MessageCircle,
  Push: Bell,
};

export const RISK_BANDS: RiskBand[] = ["Low", "Medium", "High"];
export const POINT_MULTIPLIERS = [1, 1.5, 2, 3, 5];
export const MAX_DISCOUNT = 50;

export const STATUS_ORDER: CampaignStatus[] = ["Running", "Scheduled", "Draft", "Completed"];

/** Everything the wizard edits. Matches the matching fields of `Campaign`. */
export interface CampaignDraft {
  name: string;
  channel: CampaignChannel;
  offer: string;
  discountPct: number;
  pointsMultiplier: number;
  segments: Segment[];
  regions: Region[];
  ageGroups: AgeGroup[];
  riskBands: RiskBand[];
}

export const EMPTY_DRAFT: CampaignDraft = {
  name: "",
  channel: "Email",
  offer: "",
  discountPct: 10,
  pointsMultiplier: 1,
  segments: [],
  regions: [],
  ageGroups: [],
  riskBands: [],
};

export const draftFromCampaign = (c: Campaign, name = c.name): CampaignDraft => ({
  name,
  channel: c.channel,
  offer: c.offer,
  discountPct: c.discountPct,
  pointsMultiplier: c.pointsMultiplier,
  segments: [...c.segments],
  regions: [...c.regions],
  ageGroups: [...c.ageGroups],
  riskBands: [...c.riskBands],
});

export interface CampaignTemplate {
  id: string;
  title: string;
  blurb: string;
  icon: LucideIcon;
  draft: CampaignDraft;
}

export const TEMPLATES: CampaignTemplate[] = [
  {
    id: "champion-vip",
    title: "Champion VIP reward",
    blurb: "Thank your best customers with triple points and 15% off.",
    icon: Crown,
    draft: {
      ...EMPTY_DRAFT,
      name: "Champion VIP reward",
      channel: "WhatsApp",
      offer: "VIP thank-you: early access to new arrivals and 15% off your next order.",
      discountPct: 15,
      pointsMultiplier: 3,
      segments: ["Champion"],
    },
  },
  {
    id: "at-risk-winback",
    title: "At Risk win-back",
    blurb: "Bring back customers who are drifting away with 20% off.",
    icon: HandHeart,
    draft: {
      ...EMPTY_DRAFT,
      name: "At Risk win-back",
      channel: "SMS",
      offer: "We miss you: 20% off your next order, valid for 7 days.",
      discountPct: 20,
      pointsMultiplier: 2,
      segments: ["At_Risk"],
    },
  },
  {
    id: "new-welcome",
    title: "New customer welcome",
    blurb: "Turn first-time buyers into repeat buyers with double points.",
    icon: Sparkles,
    draft: {
      ...EMPTY_DRAFT,
      name: "New customer welcome",
      channel: "Email",
      offer: "Welcome to RetailMax: 10% off your next order and double points.",
      discountPct: 10,
      pointsMultiplier: 2,
      segments: ["New"],
    },
  },
];

/** Starting point when the page is opened with ?segment=… and/or ?risk=… (from Segments or Churn). */
export function draftFromParams(segmentParam: string | null, riskParam: string | null): CampaignDraft | null {
  const norm = (v: string) => v.trim().toLowerCase().replace(/[\s_-]+/g, "_");
  const segment = segmentParam ? SEGMENTS.find((s) => s.toLowerCase() === norm(segmentParam)) : undefined;
  const risk = riskParam ? RISK_BANDS.find((r) => r.toLowerCase() === riskParam.trim().toLowerCase()) : undefined;
  if (!segment && !risk) return null;

  const template = segment ? TEMPLATES.find((t) => t.draft.segments[0] === segment) : undefined;
  if (template) {
    return { ...template.draft, name: `${segLabel(segment!)} outreach`, riskBands: risk ? [risk] : [] };
  }
  if (segment) {
    return {
      ...EMPTY_DRAFT,
      name: `${segLabel(segment)} outreach`,
      offer: "A small thank-you: 10% off your next order.",
      segments: [segment],
      riskBands: risk ? [risk] : [],
    };
  }
  // Only a risk band: every segment, narrowed to that band.
  return {
    ...EMPTY_DRAFT,
    name: `${risk} churn-risk win-back`,
    channel: "WhatsApp",
    offer: "We miss you: 15% off your next order, valid for 7 days.",
    discountPct: 15,
    pointsMultiplier: 2,
    segments: [...SEGMENTS],
    riskBands: [risk!],
  };
}

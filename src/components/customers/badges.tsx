import { ShieldCheck, ShieldOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LoyaltyTier, RiskBand, Segment } from "@/lib/data/types";

/** "At_Risk" -> "At Risk". Dataset values keep the underscore; users never see it. */
export const segmentLabel = (s: string) => s.replace(/_/g, " ");

const BASE = "gap-1.5 whitespace-nowrap border-transparent px-2 py-0.5 text-[11px] font-semibold text-foreground";

const SEGMENT: Record<Segment, { chip: string; dot: string }> = {
  Champion: { chip: "bg-success/12", dot: "bg-success" },
  Loyal: { chip: "bg-primary/12", dot: "bg-primary" },
  New: { chip: "bg-chart-2/15", dot: "bg-chart-2" },
  At_Risk: { chip: "bg-warning/15", dot: "bg-warning" },
  Lost: { chip: "bg-danger/12", dot: "bg-danger" },
};

export function SegmentBadge({ segment, className }: { segment: Segment; className?: string }) {
  const s = SEGMENT[segment];
  return (
    <Badge variant="outline" className={cn(BASE, s.chip, className)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", s.dot)} />
      {segmentLabel(segment)}
    </Badge>
  );
}

const TIER: Record<LoyaltyTier, string> = {
  Bronze: "bg-[var(--tint-cream)]",
  Silver: "bg-surface-3",
  Gold: "bg-warning/20",
  Platinum: "bg-primary/14",
};

export function TierBadge({ tier, className }: { tier: LoyaltyTier; className?: string }) {
  return <Badge variant="outline" className={cn(BASE, TIER[tier], className)}>{tier}</Badge>;
}

const RISK: Record<RiskBand, { chip: string; dot: string }> = {
  Low: { chip: "bg-success/12", dot: "bg-success" },
  Medium: { chip: "bg-warning/15", dot: "bg-warning" },
  High: { chip: "bg-danger/12", dot: "bg-danger" },
};

export function RiskBadge({ band, className }: { band: RiskBand; className?: string }) {
  const s = RISK[band];
  return (
    <Badge variant="outline" className={cn(BASE, s.chip, className)}>
      <span aria-hidden className={cn("size-1.5 rounded-full", s.dot)} />
      {band} risk
    </Badge>
  );
}

export function ConsentBadge({ granted, className }: { granted: boolean; className?: string }) {
  const Icon = granted ? ShieldCheck : ShieldOff;
  return (
    <Badge variant="outline" className={cn(BASE, granted ? "bg-success/12" : "bg-surface-3", className)}>
      <Icon aria-hidden className={cn("size-3", granted ? "text-success" : "text-text-3")} />
      {granted ? "Consent given" : "No consent"}
    </Badge>
  );
}

/** Icon-only consent marker for dense tables. */
export function ConsentIcon({ granted }: { granted: boolean }) {
  const Icon = granted ? ShieldCheck : ShieldOff;
  const label = granted ? "Marketing consent given" : "No marketing consent";
  return (
    <span title={label} className="inline-flex">
      <Icon aria-label={label} role="img" className={cn("size-4", granted ? "text-success" : "text-text-3")} />
    </span>
  );
}

/** Colour of a churn probability for bars and text. */
export const riskColorVar = (band: RiskBand) =>
  band === "High" ? "var(--danger)" : band === "Medium" ? "var(--warning)" : "var(--success)";

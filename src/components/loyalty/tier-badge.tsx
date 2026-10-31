import { Badge } from "@/components/ui/badge";
import type { LoyaltyTier } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import { TIER_COLOR } from "./rules";

const STYLE: Record<LoyaltyTier, string> = {
  Bronze: "bg-surface-3 text-text-2",
  Silver: "bg-chart-2/15 text-foreground",
  Gold: "bg-warning/20 text-warning",
  Platinum: "bg-primary-soft text-primary",
};

export function TierBadge({ tier, className }: { tier: LoyaltyTier; className?: string }) {
  return (
    <Badge variant="outline" className={cn("gap-1.5 rounded-full border-transparent px-2.5 py-0.5 text-[11px]", STYLE[tier], className)}>
      <span className="size-1.5 rounded-full" style={{ backgroundColor: TIER_COLOR[tier] }} aria-hidden />
      {tier}
    </Badge>
  );
}

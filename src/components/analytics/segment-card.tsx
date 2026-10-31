import { Link } from "react-router-dom";
import { Megaphone, Users } from "lucide-react";

import { SpotlightCard } from "@/components/motion/primitives";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { SEG_COLOR, SEG_ICON, SEG_LABEL, SEG_STRATEGY, SEG_TONE, type SegmentStats } from "./meta";

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-dashed border-border/70 py-1.5 last:border-0">
      <dt className="text-[11.5px] text-muted-foreground">{label}</dt>
      <dd className="text-[12.5px] font-medium tabular-nums">{value}</dd>
    </div>
  );
}

export function SegmentCard({ stats }: { stats: SegmentStats }) {
  const s = stats.segment;
  const color = SEG_COLOR[s];
  const strategy = SEG_STRATEGY[s];
  return (
    <SpotlightCard as="li" className="relative flex flex-col overflow-hidden p-4">
      <span aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: color }} />
      <div className="mt-1 flex items-center gap-2.5">
        <IconTile icon={SEG_ICON[s]} tone={SEG_TONE[s]} size="md" />
        <h3 className="font-display text-[15px] font-semibold tracking-tight">{SEG_LABEL[s]}</h3>
      </div>

      <p className="metric mt-4 text-[30px]">{formatNumber(stats.count)}</p>
      <p className="mt-1 text-[11.5px] text-muted-foreground">{formatPercent(stats.share * 100)} of customers</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full rounded-full" style={{ width: `${Math.max(stats.share * 100, stats.count ? 2 : 0)}%`, backgroundColor: color }} />
      </div>

      <dl className="mt-3">
        <Metric label="Avg recency" value={`${Math.round(stats.avgRecency)} days`} />
        <Metric label="Avg orders" value={stats.avgOrders.toFixed(1)} />
        <Metric label="Avg order value" value={formatCurrency(stats.avgAov)} />
        <Metric label="Revenue" value={formatCurrency(stats.revenue)} />
        <Metric label="Churn rate" value={formatPercent(stats.churnRate * 100)} />
      </dl>

      <div className="mt-3 rounded-[12px] bg-surface-2 px-3 py-2.5">
        <p className="text-[12px] font-semibold leading-snug">{strategy.headline}</p>
        <p className="mt-0.5 text-[11.5px] leading-snug text-muted-foreground">{strategy.detail}</p>
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-3">
        <Button asChild size="sm" variant="outline" className="w-full">
          <Link to={`/customers?segment=${s}`}>
            <Users /> View customers
          </Link>
        </Button>
        <Button asChild size="sm" className="w-full">
          <Link to={`/campaigns?segment=${s}`}>
            <Megaphone /> Create campaign
          </Link>
        </Button>
      </div>
    </SpotlightCard>
  );
}

import { CalendarClock, Rocket, ShieldCheck } from "lucide-react";

import { SpotlightCard } from "@/components/motion/primitives";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { formatCompact, formatCurrency, formatIST, formatNumber, formatPercent } from "@/lib/format";
import type { Campaign } from "@/lib/data/types";
import { CHANNEL_ICON, segLabel } from "./meta";
import { StatusBadge } from "./status-badge";

export const conversionPct = (c: Pick<NonNullable<Campaign["results"]>, "sent" | "converted">) =>
  c.sent > 0 ? (c.converted / c.sent) * 100 : 0;

/** "North, South · 26-35 · High risk", or "All regions and ages" when nothing narrows the audience. */
export function filterSummary(c: Pick<Campaign, "regions" | "ageGroups" | "riskBands">) {
  const parts: string[] = [];
  if (c.regions.length) parts.push(c.regions.join(", "));
  if (c.ageGroups.length) parts.push(c.ageGroups.join(", "));
  if (c.riskBands.length) parts.push(`${c.riskBands.join("/")} churn risk`);
  return parts.length ? parts.join(" · ") : "All regions, ages and risk levels";
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10.5px] uppercase tracking-wide text-text-3">{label}</p>
      <p className="metric mt-1 text-[17px] text-foreground">{value}</p>
    </div>
  );
}

export function CampaignCard({
  campaign: c,
  onOpen,
  onLaunch,
}: {
  campaign: Campaign;
  onOpen: () => void;
  onLaunch: () => void;
}) {
  const Icon = CHANNEL_ICON[c.channel];
  const excluded = Math.max(0, c.audienceSize - c.consentedSize);
  const r = c.results;
  const canLaunch = c.status === "Draft" || c.status === "Scheduled";

  return (
    <SpotlightCard as="section" className="flex h-full min-w-0 flex-col p-5" aria-label={`Campaign ${c.name}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <IconTile icon={Icon} tone="primary" />
          <div className="min-w-0">
            <button
              type="button"
              onClick={onOpen}
              className="font-display block max-w-full truncate text-left text-[15px] font-semibold tracking-tight hover:text-primary focus-visible:text-primary"
            >
              {c.name}
            </button>
            <p className="mt-0.5 text-[11.5px] text-text-3">
              {c.channel} · created {formatIST(c.createdAt, false)}
            </p>
          </div>
        </div>
        <StatusBadge status={c.status} className="shrink-0" />
      </div>

      {c.offer && <p className="mt-3 line-clamp-2 text-[12.5px] leading-relaxed text-text-2">{c.offer}</p>}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {c.segments.map((s) => (
          <Badge key={s} variant="secondary" className="rounded-full px-2 py-0.5 text-[11px] font-medium">
            {segLabel(s)}
          </Badge>
        ))}
        {c.discountPct > 0 && (
          <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px] font-medium">
            {c.discountPct}% off
          </Badge>
        )}
        {c.pointsMultiplier > 1 && (
          <Badge variant="outline" className="rounded-full px-2 py-0.5 text-[11px] font-medium">
            {c.pointsMultiplier}x points
          </Badge>
        )}
      </div>
      <p className="mt-2 text-[11.5px] text-text-3">{filterSummary(c)}</p>

      <div className="mt-4 grid grid-cols-3 gap-3 rounded-[14px] bg-surface-2 px-3.5 py-3">
        <Figure label="Matched" value={formatNumber(c.audienceSize)} />
        <Figure label="Consented reach" value={formatNumber(c.consentedSize)} />
        <Figure label="No consent" value={formatNumber(excluded)} />
      </div>
      <p className="mt-2 flex items-start gap-1.5 text-[11px] text-text-3">
        <ShieldCheck className="mt-px size-3.5 shrink-0 text-success" aria-hidden />
        Only consented customers are contacted.
      </p>

      <div className="mt-4 flex-1">
        {r ? (
          <div>
            <div className="grid grid-cols-5 gap-2">
              <Figure label="Sent" value={formatCompact(r.sent)} />
              <Figure label="Opened" value={formatCompact(r.opened)} />
              <Figure label="Clicked" value={formatCompact(r.clicked)} />
              <Figure label="Bought" value={formatCompact(r.converted)} />
              <Figure label="Revenue" value={`₹${formatCompact(r.revenue)}`} />
            </div>
            <p className="mt-3 text-[12px] text-text-2">
              <span className="font-semibold text-success">{formatPercent(conversionPct(r))}</span> of sent customers
              bought, bringing in {formatCurrency(r.revenue)}.
            </p>
          </div>
        ) : c.status === "Running" ? (
          <p className="text-[12.5px] text-text-2">Sending to consented customers. Results arrive in a moment.</p>
        ) : c.status === "Scheduled" ? (
          <p className="flex items-center gap-1.5 text-[12.5px] text-text-2">
            <CalendarClock className="size-4 text-warning" aria-hidden />
            Scheduled for {c.scheduledFor ? formatIST(c.scheduledFor, false) : "a later date"}.
          </p>
        ) : (
          <p className="text-[12.5px] text-text-2">Draft. Nothing has been sent yet.</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onOpen}>
          {r ? "View results" : "View details"}
        </Button>
        {canLaunch && (
          <Button type="button" size="sm" onClick={onLaunch} disabled={c.consentedSize === 0}>
            <Rocket className="size-3.5" />
            Launch now
          </Button>
        )}
      </div>
    </SpotlightCard>
  );
}

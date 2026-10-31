import * as React from "react";
import { Link } from "react-router-dom";
import { Coins, ShieldCheck, ShieldOff, StickyNote, type LucideIcon } from "lucide-react";
import { motion } from "motion/react";

import { RiskBadge, SegmentBadge, TierBadge, segmentLabel } from "@/components/customers/badges";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePrefersReducedMotion } from "@/hooks/use-motion-prefs";
import { TIER_THRESHOLDS } from "@/lib/data/derive";
import { LOYALTY_TIERS, type Customer } from "@/lib/data/types";
import { formatCurrency, formatIST, formatNumber, relativeTime } from "@/lib/format";
import { D, E } from "@/lib/motion";
import { cn } from "@/lib/utils";

/* ------------------------------ Tier progress ------------------------------ */

export function TierProgress({ points, tier }: { points: number; tier: Customer["tier"] }) {
  const next = LOYALTY_TIERS[LOYALTY_TIERS.indexOf(tier) + 1];
  if (!next) {
    return (
      <div>
        <Progress value={100} aria-label="Top loyalty tier reached" />
        <p className="mt-2 text-xs text-text-2">Top tier reached. Nothing more to unlock.</p>
      </div>
    );
  }
  const lo = TIER_THRESHOLDS[tier];
  const hi = TIER_THRESHOLDS[next];
  const pct = Math.max(0, Math.min(100, ((points - lo) / (hi - lo)) * 100));
  return (
    <div>
      <div className="flex items-center justify-between text-[11px] text-text-3">
        <span>
          {tier} · {formatNumber(lo)}
        </span>
        <span>
          {next} · {formatNumber(hi)}
        </span>
      </div>
      <Progress value={pct} className="mt-1.5" aria-label={`Progress from ${tier} to ${next}`} />
      <p className="mt-2 text-xs text-text-2">
        <span className="font-semibold text-foreground tnum">{formatNumber(hi - points)}</span> points to reach {next}
      </p>
    </div>
  );
}

/* ------------------------------ RFM block ------------------------------ */

function ScoreBar({ label, score, detail }: { label: string; score: number; detail: string }) {
  const reduced = usePrefersReducedMotion();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-[13px]">
        <span className="font-medium">{label}</span>
        <span className="text-text-3">
          {detail} · <span className="font-semibold text-foreground tnum">{score}/5</span>
        </span>
      </div>
      <div role="img" aria-label={`${label} score ${score} out of 5`} className="mt-1.5 grid grid-cols-5 gap-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <motion.span
            key={i}
            aria-hidden
            className={cn("h-2 rounded-full", i <= score ? "bg-primary" : "bg-surface-3")}
            initial={reduced ? false : { opacity: 0, scaleY: 0.4 }}
            animate={{ opacity: 1, scaleY: 1 }}
            transition={{ duration: D.base, ease: E.out, delay: i * 0.05 }}
          />
        ))}
      </div>
    </div>
  );
}

export function RfmBlock({ c }: { c: Customer }) {
  const differs = c.rfm_segment !== c.computedSegment;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-micro text-text-2">RFM score</p>
        <p className="metric text-[28px] tracking-[0.18em] text-primary">
          {c.rfmScore}
        </p>
      </div>
      <ScoreBar label="Recency" score={c.r} detail={`${formatNumber(c.last_purchase_days)} days ago`} />
      <ScoreBar label="Frequency" score={c.f} detail={`${formatNumber(c.purchase_freq)} orders`} />
      <ScoreBar label="Monetary" score={c.m} detail={formatCurrency(c.monetary)} />
      <div className="rounded-lg bg-surface-2 p-3 text-[12px]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-2">
            <span className="text-text-3">Dataset label</span> <SegmentBadge segment={c.rfm_segment} />
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="text-text-3">CRM-computed</span> <SegmentBadge segment={c.computedSegment} />
          </span>
        </div>
        <p className="mt-2 leading-relaxed text-text-2">
          {differs
            ? `The file says ${segmentLabel(c.rfm_segment)}, but the CRM scores this customer ${segmentLabel(c.computedSegment)} from live R and F quintiles.`
            : "The dataset label and the CRM-computed segment agree."}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------ Timeline ------------------------------ */

export interface TimelineItem {
  id: string;
  kind: "note" | "points" | "consent";
  at: string;
  title: string;
  detail?: string;
  tone?: "up" | "down";
}

const KIND_ICON: Record<TimelineItem["kind"], LucideIcon> = {
  note: StickyNote,
  points: Coins,
  consent: ShieldCheck,
};

function TimelineList({ items, empty }: { items: TimelineItem[]; empty: string }) {
  if (!items.length) {
    return <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-[13px] text-text-3">{empty}</p>;
  }
  return (
    <ol className="max-h-[22rem] space-y-0 overflow-y-auto pr-1">
      {items.map((it, i) => {
        const Icon = it.kind === "consent" && it.tone === "down" ? ShieldOff : KIND_ICON[it.kind];
        return (
          <li key={it.id} className="relative flex gap-3 pb-4 last:pb-0">
            {i < items.length - 1 && <span aria-hidden className="absolute left-[13px] top-7 bottom-0 w-px bg-border" />}
            <span
              aria-hidden
              className={cn(
                "z-[1] flex size-7 shrink-0 items-center justify-center rounded-full ring-1 ring-inset",
                it.kind === "points" && it.tone === "down"
                  ? "bg-warning/12 text-warning ring-warning/25"
                  : it.kind === "points"
                    ? "bg-success/12 text-success ring-success/25"
                    : it.kind === "consent" && it.tone === "down"
                      ? "bg-surface-3 text-text-2 ring-border"
                      : it.kind === "consent"
                        ? "bg-success/12 text-success ring-success/25"
                        : "bg-primary/10 text-primary ring-primary/20",
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-[13px] font-medium">{it.title}</p>
                <time dateTime={it.at} title={formatIST(it.at)} className="text-[11px] text-text-3">
                  {relativeTime(it.at)}
                </time>
              </div>
              {it.detail && <p className="mt-0.5 whitespace-pre-wrap break-words text-[12.5px] text-text-2">{it.detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function Timeline({ items }: { items: TimelineItem[] }) {
  const by = (k: TimelineItem["kind"]) => items.filter((i) => i.kind === k);
  const notes = by("note");
  const points = by("points");
  const consent = by("consent");
  return (
    <Tabs defaultValue="all">
      <TabsList className="h-auto flex-wrap justify-start">
        <TabsTrigger value="all">All ({items.length})</TabsTrigger>
        <TabsTrigger value="note">Notes ({notes.length})</TabsTrigger>
        <TabsTrigger value="points">Points ({points.length})</TabsTrigger>
        <TabsTrigger value="consent">Consent ({consent.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="all" className="mt-4">
        <TimelineList items={items} empty="No activity yet. Notes, point changes and consent changes will show here." />
      </TabsContent>
      <TabsContent value="note" className="mt-4">
        <TimelineList items={notes} empty="No notes yet. Add one on the left." />
      </TabsContent>
      <TabsContent value="points" className="mt-4">
        <TimelineList items={points} empty="No point changes yet. Use Award / redeem points." />
      </TabsContent>
      <TabsContent value="consent" className="mt-4">
        <TimelineList items={consent} empty="No consent changes yet. The starting consent comes from the dataset defaults." />
      </TabsContent>
    </Tabs>
  );
}

/* ------------------------------ Similar customers ------------------------------ */

export function SimilarList({ list, region, segment }: { list: Customer[]; region: string; segment: Customer["computedSegment"] }) {
  if (!list.length) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-[13px] text-text-3">
        No other {segmentLabel(segment)} customers in {region}.
      </p>
    );
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {list.map((o) => (
        <li key={o.customer_id}>
          <Link
            to={`/customers/${encodeURIComponent(o.customer_id)}`}
            className="soft-card soft-card-hover block h-full p-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <p className="text-[13px] font-semibold text-primary">{o.customer_id}</p>
            <p className="metric mt-2 text-[17px]">{formatCurrency(o.monetary)}</p>
            <p className="mt-0.5 text-[11px] text-text-3">lifetime value</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <RiskBadge band={o.riskBand} />
              <TierBadge tier={o.tier} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

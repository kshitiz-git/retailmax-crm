import * as React from "react";
import { motion } from "motion/react";
import { Lightbulb, ArrowDownRight, ArrowUpRight, Info } from "lucide-react";

import { SpotlightCard } from "@/components/motion/primitives";
import { NumberTicker } from "@/components/motion/number-ticker";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { D, E } from "@/lib/motion";
import { useInViewOnce, usePrefersReducedMotion } from "@/hooks/use-motion-prefs";
import { formatCurrency, formatHours, formatNumber, formatPercent } from "@/lib/format";
import type { Delta, PulseTile } from "@/lib/kpi-types";

/* -------------------------------- Panel -------------------------------- */

export type PanelProps = {
  title: string;
  subtitle?: string;
  insight?: string;
  help?: string;
  actions?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
  /** Grid span at lg and up: 1 = third, 2 = two-thirds, 3 = full. */
  span?: 1 | 2 | 3;
};

const spanClass: Record<1 | 2 | 3, string> = {
  1: "lg:col-span-1",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
};

export function Panel({
  title,
  subtitle,
  insight,
  help,
  actions,
  className,
  bodyClassName,
  children,
  span = 1,
}: PanelProps) {
  const reduced = usePrefersReducedMotion();
  const { ref, inView } = useInViewOnce<HTMLDivElement>();

  return (
    <motion.div
      ref={ref}
      initial={reduced ? false : { opacity: 0, y: 14 }}
      animate={inView || reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
      transition={{ duration: D.base, ease: E.out }}
      className={cn(spanClass[span], "min-w-0", className)}
    >
      <SpotlightCard className="flex h-full flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="font-display truncate text-[15px] font-semibold tracking-tight">{title}</h3>
              {help && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger aria-label={`About ${title}`} className="text-text-3 hover:text-foreground">
                      <Info className="size-3.5" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-64 text-xs">{help}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            {subtitle && <p className="mt-1 truncate text-[11.5px] text-text-3">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
        </div>

        <div className={cn("mt-5 min-w-0 flex-1", bodyClassName)}>{inView ? children : <Skeleton className="h-40 w-full" />}</div>

        {insight && (
          <p className="mt-5 flex items-start gap-2 rounded-[14px] bg-surface-2 px-3 py-2.5 text-[11.5px] leading-relaxed text-text-2">
            <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <span>{insight}</span>
          </p>
        )}
      </SpotlightCard>
    </motion.div>
  );
}

export function PanelGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3", className)}>{children}</div>;
}

export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5 mt-12 first:mt-0">
      <p className="text-micro text-primary">{eyebrow}</p>
      <h2 className="text-h1 mt-1.5">{title}</h2>
      {description && <p className="mt-1.5 max-w-2xl text-[12.5px] text-text-3">{description}</p>}
    </div>
  );
}

/* ------------------------------ Delta chip ------------------------------ */

export function DeltaChip({ delta, invert = false, onHero = false }: { delta: Delta; invert?: boolean; onHero?: boolean }) {
  const good = invert ? delta.direction === "down" : delta.direction === "up";
  const Icon = delta.direction === "up" ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold tabular-nums",
        onHero
          ? "bg-primary-foreground/18 text-primary-foreground"
          : good
            ? "bg-success/12 text-success"
            : "bg-destructive/12 text-destructive",
      )}
    >
      <Icon className="size-3" />
      {delta.value.toFixed(1)}%
    </span>
  );
}

/* -------------------------------- KPI tile -------------------------------- */

const FORMATTERS: Record<PulseTile["format"], (v: number) => string> = {
  number: formatNumber,
  currency: formatCurrency,
  hours: formatHours,
  percent: (v) => formatPercent(v),
};

export type Tint = "pink" | "mint" | "lilac" | "cream" | "plain";

const TINT_CARD: Record<Tint, string> = {
  pink: "tint-pink",
  mint: "tint-mint",
  lilac: "tint-lilac",
  cream: "tint-cream",
  plain: "",
};

const TINT_INK: Record<Tint, string> = {
  pink: "ink-pink",
  mint: "ink-mint",
  lilac: "ink-lilac",
  cream: "ink-cream",
  plain: "text-primary",
};

export function KpiTile({
  tile,
  invertDelta = false,
  hero = false,
  tint = "plain",
}: {
  tile: PulseTile;
  invertDelta?: boolean;
  hero?: boolean;
  tint?: Tint;
}) {
  const reduced = usePrefersReducedMotion();
  const format = FORMATTERS[tile.format];
  const max = Math.max(...tile.spark, 1);
  const good = invertDelta ? tile.delta.direction === "down" : tile.delta.direction === "up";
  const Arrow = tile.delta.direction === "up" ? ArrowUpRight : ArrowDownRight;

  return (
    <SpotlightCard
      className={cn(
        "group relative flex flex-col justify-between overflow-hidden p-5",
        hero ? "violet-gradient border-transparent text-primary-foreground" : TINT_CARD[tint],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-micro", hero ? "text-primary-foreground/75" : "text-text-2")}>{tile.label}</p>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold tabular-nums",
            hero
              ? "bg-primary-foreground/20 text-primary-foreground"
              : cn("bg-surface/80", good ? "text-success" : "text-destructive"),
          )}
        >
          {tile.delta.direction === "down" ? "−" : "+"}
          {tile.delta.value.toFixed(1)}%
        </span>
      </div>

      <p
        className={cn("metric mt-5 text-[30px]", hero ? "text-primary-foreground" : "text-foreground")}
        suppressHydrationWarning
      >
        <NumberTicker value={tile.value} format={format} />
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p
          className={cn("text-[11.5px]", hero ? "text-primary-foreground/75" : "text-text-2")}
          suppressHydrationWarning
        >
          {tile.sub}
        </p>
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded-full transition-transform duration-200 group-hover:translate-x-0.5",
            hero ? "bg-primary-foreground/20 text-primary-foreground" : cn("bg-surface/85", TINT_INK[tint]),
          )}
          aria-hidden
        >
          <Arrow className="size-3.5" strokeWidth={2} />
        </span>
      </div>

      {tile.split && (
        <div className={cn("mt-4 flex h-1.5 overflow-hidden rounded-full", hero ? "bg-primary-foreground/25" : "bg-surface/70")}>
          {tile.split.map((s) => (
            <motion.span
              key={s.label}
              initial={reduced ? false : { width: 0 }}
              animate={{ width: `${(s.value / tile.value) * 100}%` }}
              transition={{ duration: D.chart, ease: E.out }}
              style={{ backgroundColor: hero ? "currentColor" : s.color }}
              title={`${s.label}: ${formatNumber(s.value)}`}
            />
          ))}
        </div>
      )}

      <svg
        viewBox="0 0 100 28"
        preserveAspectRatio="none"
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-0 h-9 w-full transition-opacity duration-300",
          hero ? "opacity-35 group-hover:opacity-55" : "opacity-30 group-hover:opacity-55",
        )}
        aria-hidden
      >
        <motion.polyline
          initial={reduced ? false : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: D.chart, ease: E.out }}
          fill="none"
          stroke={hero ? "currentColor" : "currentColor"}
          strokeWidth="1.4"
          className={hero ? undefined : TINT_INK[tint]}
          points={tile.spark
            .map((v, i) => `${(i / (tile.spark.length - 1)) * 100},${28 - (v / max) * 24}`)
            .join(" ")}
        />
      </svg>
    </SpotlightCard>
  );
}

const TINT_CYCLE: Tint[] = ["mint", "pink", "mint", "lilac", "cream"];

export function KpiRow({ tiles }: { tiles: PulseTile[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
      {tiles.map((t, i) => (
        <KpiTile
          key={t.key}
          tile={t}
          hero={i === 0}
          tint={TINT_CYCLE[(i - 1 + TINT_CYCLE.length) % TINT_CYCLE.length] ?? "plain"}
          invertDelta={t.key === "cpl" || t.key === "float"}
        />
      ))}
    </div>
  );
}



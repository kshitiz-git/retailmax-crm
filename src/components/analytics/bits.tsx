import * as React from "react";

import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/format";
import { RISK_COLOR, SEG_COLOR, SEG_LABEL, tint } from "./meta";
import type { RiskBand, Segment } from "@/lib/data/types";

/** Shared axis look, same as the app charts. */
export const AXIS = {
  stroke: "var(--border)",
  tick: { fill: "var(--text-3)", fontSize: 10 },
  tickLine: false,
  axisLine: false,
} as const;

type TipProps = {
  active?: boolean;
  payload?: Array<{ name?: string | number; value?: number | string; color?: string; payload?: Record<string, unknown> }>;
  label?: string | number;
};

function Tip({ active, payload, label, fmt }: TipProps & { fmt: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover/95 px-2.5 py-2 text-xs shadow-xl backdrop-blur">
      {label !== undefined && <p className="mb-1 font-medium">{label}</p>}
      <ul className="space-y-0.5">
        {payload.map((p, i) => (
          <li key={i} className="flex items-center gap-2 tabular-nums">
            <span className="size-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto font-medium">{typeof p.value === "number" ? fmt(p.value) : p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const pct1 = (v: number) => `${v.toFixed(1)}%`;
export const PctTip = (props: TipProps) => <Tip {...props} fmt={pct1} />;
export const CountTip = (props: TipProps) => <Tip {...props} fmt={formatNumber} />;
export const MoneyTip = (props: TipProps) => <Tip {...props} fmt={formatCurrency} />;

/** Coloured pill: dot + segment name. */
export function SegmentChip({ segment, className }: { segment: Segment; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", className)}
      style={{ backgroundColor: tint(SEG_COLOR[segment], 16) }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: SEG_COLOR[segment] }} />
      {SEG_LABEL[segment]}
    </span>
  );
}

export function RiskChip({ band, className }: { band: RiskBand; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", className)}
      style={{ backgroundColor: tint(RISK_COLOR[band], 16) }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: RISK_COLOR[band] }} />
      {band}
    </span>
  );
}

/** Small label + big number tile used for model metrics and summaries. */
export function StatTile({
  label,
  value,
  sub,
  className,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
  accent?: string;
}) {
  return (
    <div className={cn("rounded-[14px] border border-border bg-surface-2/60 px-4 py-3.5", className)}>
      <p className="text-micro text-muted-foreground">{label}</p>
      <p className="metric mt-2.5 text-[26px]" style={accent ? { color: accent } : undefined}>
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[11.5px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Segmented control (two to four options) built on plain buttons. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex rounded-lg bg-muted p-1 text-muted-foreground", className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "cursor-pointer whitespace-nowrap rounded-md px-3 py-1 text-[13px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "bg-background text-foreground shadow" : "hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

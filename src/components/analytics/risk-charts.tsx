import * as React from "react";
import { Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from "recharts";

import { cn } from "@/lib/utils";
import { ChartFrame } from "@/components/panels/charts";
import { formatCompact, formatNumber, formatPercent } from "@/lib/format";
import { churnModel } from "@/lib/ml/churn";
import { SEGMENTS, type Customer, type RiskBand } from "@/lib/data/types";
import { AXIS, CountTip, PctTip, RiskChip } from "./bits";
import { RISK_COLOR, SEG_LABEL, mean } from "./meta";

const BANDS: RiskBand[] = ["Low", "Medium", "High"];

/** Histogram of churn probability in 10 bins, each bar stacked by risk band. */
export function RiskHistogram({ customers }: { customers: Customer[] }) {
  const data = React.useMemo(() => {
    const bins = Array.from({ length: 10 }, (_, i) => ({
      label: `${i * 10}-${i * 10 + 10}%`,
      Low: 0,
      Medium: 0,
      High: 0,
    }));
    for (const c of customers) {
      const i = Math.min(9, Math.floor(c.churnProb * 10));
      bins[i]![c.riskBand]++;
    }
    return bins;
  }, [customers]);

  const t = churnModel.threshold || 0.5;
  return (
    <div>
      <ChartFrame height={230}>
        <BarChart data={data} margin={{ top: 6, right: 6, left: -12, bottom: 0 }} barCategoryGap="12%">
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} opacity={0.5} />
          <XAxis dataKey="label" {...AXIS} interval={0} tick={{ fill: "var(--text-3)", fontSize: 9 }} />
          <YAxis {...AXIS} width={42} tickFormatter={(v: number) => formatCompact(v)} />
          <Tooltip content={<CountTip />} cursor={{ fill: "var(--surface-3)", opacity: 0.35 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" />
          {BANDS.map((b, i) => (
            <Bar
              key={b}
              dataKey={b}
              name={`${b} risk`}
              stackId="risk"
              fill={RISK_COLOR[b]}
              radius={i === BANDS.length - 1 ? [4, 4, 0, 0] : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ChartFrame>
      <p className="mt-2 text-[10.5px] text-muted-foreground">
        High = {formatPercent(t * 100, 0)} or more · Medium = {formatPercent(t * 60, 0)} to {formatPercent(t * 100, 0)} ·
        Low = below {formatPercent(t * 60, 0)}. Bars show customers per probability bucket.
      </p>
    </div>
  );
}

/** Three clickable tiles: customers per risk band. */
export function RiskBandTiles({
  customers,
  active,
  onPick,
}: {
  customers: Customer[];
  active: RiskBand | "all";
  onPick: (b: RiskBand) => void;
}) {
  const info = React.useMemo(() => {
    const out = Object.fromEntries(BANDS.map((b) => [b, { n: 0, consented: 0, probSum: 0 }])) as Record<
      RiskBand,
      { n: number; consented: number; probSum: number }
    >;
    for (const c of customers) {
      const o = out[c.riskBand];
      o.n++;
      o.probSum += c.churnProb;
      if (c.consent) o.consented++;
    }
    return out;
  }, [customers]);
  const total = customers.length || 1;

  return (
    <ul className="space-y-2.5">
      {[...BANDS].reverse().map((b) => {
        const o = info[b];
        const isActive = active === b;
        return (
          <li key={b}>
            <button
              type="button"
              onClick={() => onPick(b)}
              aria-pressed={isActive}
              aria-label={`Show ${b} risk customers in the table`}
              className={cn(
                "w-full cursor-pointer rounded-[14px] border px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive ? "border-primary/60 bg-primary-soft" : "border-border bg-surface-2/60 hover:border-primary/30",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <RiskChip band={b} />
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {formatPercent((o.n / total) * 100)} of base
                </span>
              </div>
              <p className="metric mt-2.5 text-[24px]">{formatNumber(o.n)}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Avg risk {o.n ? formatPercent((o.probSum / o.n) * 100) : "n/a"} · {formatNumber(o.consented)} reachable
                (consent given)
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Mean predicted churn probability against the real churn rate, overall and per CRM segment. */
export function PredictedVsActual({ customers }: { customers: Customer[] }) {
  const { data, overall } = React.useMemo(() => {
    const groups = [{ key: "all", label: "All", list: customers }].concat(
      SEGMENTS.map((s) => ({ key: s, label: SEG_LABEL[s], list: customers.filter((c) => c.computedSegment === s) })),
    );
    const rows = groups.map((g) => ({
      label: g.label,
      Predicted: mean(g.list.map((c) => c.churnProb)) * 100,
      Actual: mean(g.list.map((c) => c.churn_flag)) * 100,
    }));
    return { data: rows, overall: rows[0]! };
  }, [customers]);

  return (
    <div>
      <ChartFrame height={230}>
        <BarChart data={data} margin={{ top: 6, right: 6, left: -12, bottom: 0 }} barGap={2}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} opacity={0.5} />
          <XAxis dataKey="label" {...AXIS} interval={0} />
          <YAxis {...AXIS} width={40} tickFormatter={(v: number) => `${v}%`} />
          <Tooltip content={<PctTip />} cursor={{ fill: "var(--surface-3)", opacity: 0.35 }} />
          <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" />
          <Bar dataKey="Predicted" fill="var(--chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="Actual" fill="var(--chart-4)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ChartFrame>
      <p className="mt-2 text-[10.5px] text-muted-foreground">
        Overall: model expects {overall.Predicted.toFixed(1)}% churn, the data shows {overall.Actual.toFixed(1)}%. Bars of
        similar height mean the scores are well calibrated.
      </p>
    </div>
  );
}

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Pie,
  PieChart,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";
import { D, E } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/hooks/use-motion-prefs";
import { formatCompact, formatCurrency, formatNumber } from "@/lib/format";

const AXIS = {
  stroke: "var(--border)",
  tick: { fill: "var(--text-3)", fontSize: 10 },
  tickLine: false,
  axisLine: false,
} as const;

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

export function ChartFrame({ children, height = 220, className }: { children: React.ReactNode; height?: number; className?: string }) {
  return (
    <div className={cn("w-full", className)} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

function TipBox({
  active,
  payload,
  label,
  valueFormat,
}: {
  active?: boolean;
  payload?: Array<{ name?: string | number; value?: number | string; color?: string; payload?: Record<string, unknown> }>;
  label?: string | number;
  valueFormat?: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const fmt = valueFormat ?? ((v: number) => formatNumber(v));
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

export const ChartTip = (props: unknown) => <TipBox {...(props as Record<string, never>)} />;
export const CurrencyTip = (props: unknown) => (
  <TipBox {...(props as Record<string, never>)} valueFormat={formatCurrency} />
);

/* --------------------------------- Charts --------------------------------- */

export function AreaTrend({
  data,
  keys,
  height = 220,
  stacked = false,
  currency = false,
}: {
  data: Array<Record<string, number | string>>;
  keys: string[];
  height?: number;
  stacked?: boolean;
  currency?: boolean;
}) {
  return (
    <ChartFrame height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 6, left: 0, bottom: 0 }}>
        <defs>
          {keys.map((k, i) => (
            <linearGradient key={k} id={`grad-${k.replace(/\W/g, "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.45} />
              <stop offset="100%" stopColor={CHART_COLORS[i % CHART_COLORS.length]} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} opacity={0.5} />
        <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={24} />
        <YAxis {...AXIS} width={currency ? 58 : 46} tickFormatter={(v: number) => (currency ? `₹${formatCompact(v)}` : formatCompact(v))} />
        <Tooltip content={currency ? <CurrencyTip /> : <ChartTip />} />
        {keys.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" />}
        {keys.map((k, i) => (
          <Area
            key={k}
            type="monotone"
            dataKey={k}
            {...(stacked ? { stackId: "1" } : {})}
            stroke={CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={1.8}
            fill={`url(#grad-${k.replace(/\W/g, "")})`}
            animationDuration={D.chart * 1000}
          />
        ))}
      </AreaChart>
    </ChartFrame>
  );
}

export function BarSeries({
  data,
  keys,
  height = 220,
  stacked = false,
  horizontal = false,
  currency = false,
  colorByIndex = false,
  dangerKey,
}: {
  data: Array<Record<string, number | string | boolean>>;
  keys: string[];
  height?: number;
  stacked?: boolean;
  horizontal?: boolean;
  currency?: boolean;
  colorByIndex?: boolean;
  dangerKey?: string;
}) {
  const catKey = "label" in (data[0] ?? {}) ? "label" : Object.keys(data[0] ?? { label: "" })[0]!;
  return (
    <ChartFrame height={height}>
      <BarChart
        data={data}
        layout={horizontal ? "vertical" : "horizontal"}
        margin={{ top: 4, right: 10, left: horizontal ? 8 : 0, bottom: 0 }}
      >
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={horizontal} horizontal={!horizontal} opacity={0.5} />
        {horizontal && (
          <XAxis type="number" {...AXIS} tickFormatter={(v: number) => (currency ? `₹${formatCompact(v)}` : formatCompact(v))} />
        )}
        {horizontal && <YAxis type="category" dataKey={catKey} {...AXIS} width={124} />}
        {!horizontal && <XAxis dataKey={catKey} {...AXIS} interval="preserveStartEnd" minTickGap={16} />}
        {!horizontal && (
          <YAxis {...AXIS} width={currency ? 58 : 46} tickFormatter={(v: number) => (currency ? `₹${formatCompact(v)}` : formatCompact(v))} />
        )}
        <Tooltip content={currency ? <CurrencyTip /> : <ChartTip />} cursor={{ fill: "var(--surface-3)", opacity: 0.35 }} />
        {keys.length > 1 && <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" />}
        {keys.map((k, i) => (
          <Bar
            key={k}
            dataKey={k}
            {...(stacked ? { stackId: "1" } : {})}
            radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
            fill={CHART_COLORS[i % CHART_COLORS.length]}
            isAnimationActive={false}
          >
            {(colorByIndex || dangerKey) &&
              data.map((row, ri) => (
                <Cell
                  key={ri}
                  fill={
                    dangerKey && row[dangerKey]
                      ? "var(--chart-7)"
                      : colorByIndex
                        ? CHART_COLORS[ri % CHART_COLORS.length]!
                        : CHART_COLORS[i % CHART_COLORS.length]!
                  }
                />
              ))}
          </Bar>
        ))}
      </BarChart>
    </ChartFrame>
  );
}

export function LineSeries({
  data,
  keys,
  height = 220,
  target,
}: {
  data: Array<Record<string, number | string>>;
  keys: string[];
  height?: number;
  target?: number;
}) {
  return (
    <ChartFrame height={height}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} opacity={0.5} />
        <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={24} />
        <YAxis {...AXIS} width={44} tickFormatter={(v: number) => formatCompact(v)} />
        <Tooltip content={<ChartTip />} />
        {target !== undefined && (
          <ReferenceLine
            y={target}
            stroke="var(--chart-4)"
            strokeDasharray="4 4"
            label={{ value: "target", fill: "var(--chart-4)", fontSize: 10, position: "insideTopRight" }}
          />
        )}
        {keys.map((k, i) => (
          <Line
            key={k}
            type="monotone"
            dataKey={k}
            stroke={CHART_COLORS[i % CHART_COLORS.length]}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
            animationDuration={D.chart * 1000}
          />
        ))}
      </LineChart>
    </ChartFrame>
  );
}

export function DualAxis({
  data,
  barKey,
  lineKey,
  height = 240,
}: {
  data: Array<Record<string, number | string>>;
  barKey: string;
  lineKey: string;
  height?: number;
}) {
  return (
    <ChartFrame height={height}>
      <ComposedChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} opacity={0.5} />
        <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={24} />
        <YAxis yAxisId="left" {...AXIS} width={42} tickFormatter={(v: number) => formatCompact(v)} />
        <YAxis yAxisId="right" orientation="right" {...AXIS} width={38} tickFormatter={(v: number) => `${v}%`} />
        <Tooltip content={<ChartTip />} />
        <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" />
        <Bar yAxisId="left" dataKey={barKey} fill="var(--chart-1)" radius={[4, 4, 0, 0]} animationDuration={D.chart * 1000} />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey={lineKey}
          stroke="var(--chart-3)"
          strokeWidth={2}
          dot={false}
          animationDuration={D.chart * 1000}
        />
      </ComposedChart>
    </ChartFrame>
  );
}

export function DonutChart({
  data,
  height = 220,
  centerLabel,
  centerValue,
}: {
  data: Array<{ key: string; value: number; color: string }>;
  height?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  return (
    <div className="relative">
      <ChartFrame height={height}>
        <PieChart>
          <Tooltip content={<ChartTip />} />
          <Pie
            data={data}
            dataKey="value"
            nameKey="key"
            innerRadius="60%"
            outerRadius="88%"
            paddingAngle={2}
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((d) => (
              <Cell key={d.key} fill={d.color} />
            ))}
          </Pie>
        </PieChart>
      </ChartFrame>
      {centerValue && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xl font-semibold tabular-nums">{centerValue}</p>
          {centerLabel && <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{centerLabel}</p>}
        </div>
      )}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="size-2 rounded-full" style={{ backgroundColor: d.color }} />
            {d.key}
            <span className="font-medium text-foreground tabular-nums">{formatNumber(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RadarCompare({
  data,
  keys,
  height = 250,
}: {
  data: Array<Record<string, number | string>>;
  keys: string[];
  height?: number;
}) {
  return (
    <ChartFrame height={height}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis dataKey="axis" tick={{ fill: "var(--text-3)", fontSize: 10 }} />
        <PolarRadiusAxis tick={false} axisLine={false} />
        <Tooltip content={<ChartTip />} />
        <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" />
        {keys.map((k, i) => (
          <Radar
            key={k}
            dataKey={k}
            stroke={CHART_COLORS[i % CHART_COLORS.length]}
            fill={CHART_COLORS[i % CHART_COLORS.length]}
            fillOpacity={0.18}
            animationDuration={D.chart * 1000}
          />
        ))}
      </RadarChart>
    </ChartFrame>
  );
}

export function BubbleScatter({
  data,
  height = 280,
  xLabel,
  yLabel,
}: {
  data: Array<{ name: string; x: number; y: number; z: number; fill: string }>;
  height?: number;
  xLabel: string;
  yLabel: string;
}) {
  return (
    <ChartFrame height={height}>
      <ScatterChart margin={{ top: 8, right: 12, left: -6, bottom: 12 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" opacity={0.5} />
        <XAxis
          type="number"
          dataKey="x"
          name={xLabel}
          {...AXIS}
          tickFormatter={(v: number) => formatCompact(v)}
          label={{ value: xLabel, fill: "var(--text-3)", fontSize: 10, position: "insideBottom", offset: -8 }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name={yLabel}
          {...AXIS}
          width={52}
          tickFormatter={(v: number) => `₹${formatCompact(v)}`}
        />
        <ZAxis type="number" dataKey="z" range={[60, 520]} />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0]?.payload as { name: string; x: number; y: number; z: number } | undefined;
            if (!p) return null;
            return (
              <div className="rounded-lg border border-border bg-popover/95 px-2.5 py-2 text-xs shadow-xl backdrop-blur">
                <p className="font-medium">{p.name}</p>
                <p className="text-muted-foreground">
                  {xLabel}: <span className="text-foreground tabular-nums">{formatNumber(p.x)}</span>
                </p>
                <p className="text-muted-foreground">
                  {yLabel}: <span className="text-foreground tabular-nums">{formatCurrency(p.y)}</span>
                </p>
                <p className="text-muted-foreground">
                  Revenue: <span className="text-foreground tabular-nums">{formatCurrency(p.z)}</span>
                </p>
              </div>
            );
          }}
        />
        <Scatter data={data} animationDuration={D.chart * 1000}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.fill} fillOpacity={0.65} stroke={d.fill} />
          ))}
        </Scatter>
      </ScatterChart>
    </ChartFrame>
  );
}

export function TreemapChart({ data, height = 240 }: { data: Array<{ name: string; size: number; fill: string }>; height?: number }) {
  return (
    <ChartFrame height={height}>
      <Treemap data={data} dataKey="size" nameKey="name" stroke="var(--surface)" animationDuration={D.chart * 1000} />
    </ChartFrame>
  );
}

/* ------------------------------ Custom visuals ------------------------------ */

export function FunnelPanel({ stages }: { stages: Array<{ stage: string; value: number; drop: number; pct: number }> }) {
  const reduced = usePrefersReducedMotion();
  const worst = Math.max(...stages.slice(1).map((s) => s.drop));

  return (
    <ul className="space-y-2.5">
      {stages.map((s, i) => (
        <li key={s.stage}>
          <div className="flex items-baseline justify-between text-[11px]">
            <span className="font-medium">{s.stage}</span>
            <span className="tabular-nums text-muted-foreground">
              {formatNumber(s.value)} · {s.pct}%
            </span>
          </div>
          <div className="mt-1 h-6 overflow-hidden rounded-md bg-muted/60">
            <motion.div
              initial={reduced ? false : { width: 0 }}
              animate={{ width: `${s.pct}%` }}
              transition={{ duration: D.chart, ease: E.out, delay: i * 0.06 }}
              className="h-full rounded-md bg-linear-to-r from-primary to-accent"
            />
          </div>
          {i > 0 && (
            <p
              className={cn(
                "mt-1 text-[10px] tabular-nums",
                s.drop === worst ? "font-semibold text-destructive" : "text-muted-foreground",
              )}
            >
              −{s.drop}% from previous step
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function Heatmap({
  days,
  grid,
}: {
  days: string[];
  grid: Array<Array<{ day: string; hour: number; rate: number; volume: number }>>;
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="min-w-0 overflow-x-auto">
      <div className="min-w-[520px]">
        <div className="mb-1 grid grid-cols-[32px_repeat(24,1fr)] gap-[2px] text-[9px] text-muted-foreground">
          <span />
          {Array.from({ length: 24 }, (_, h) => (
            <span key={h} className="text-center">
              {h % 3 === 0 ? h : ""}
            </span>
          ))}
        </div>
        {grid.map((row, di) => (
          <div key={days[di]} className="grid grid-cols-[32px_repeat(24,1fr)] items-center gap-[2px]">
            <span className="text-[9px] text-muted-foreground">{days[di]}</span>
            {row.map((cell) => (
              <motion.span
                key={cell.hour}
                initial={reduced ? false : { opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: D.fast, delay: (di * 24 + cell.hour) * 0.0015 }}
                title={`${cell.day} ${cell.hour}:00 — ${cell.rate}% connect, ${cell.volume} calls`}
                className="aspect-square rounded-[2px] transition-transform duration-150 hover:scale-125"
                style={{
                  backgroundColor: `color-mix(in oklab, var(--chart-3) ${Math.round(cell.rate)}%, var(--surface-3))`,
                }}
              />
            ))}
          </div>
        ))}
        <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>Low</span>
          <span className="h-2 flex-1 rounded-full bg-linear-to-r from-muted to-chart-3" />
          <span>High connect rate</span>
        </div>
      </div>
    </div>
  );
}

export function Gauge({ value, label }: { value: number; label: string }) {
  const reduced = usePrefersReducedMotion();
  const r = 54;
  const circ = Math.PI * r;
  return (
    <div className="flex flex-col items-center justify-center py-2">
      <svg viewBox="0 0 140 78" className="w-full max-w-[220px]">
        <path d="M16 70 A54 54 0 0 1 124 70" fill="none" stroke="var(--surface-3)" strokeWidth="12" strokeLinecap="round" />
        <motion.path
          d="M16 70 A54 54 0 0 1 124 70"
          fill="none"
          stroke="var(--chart-3)"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={reduced ? false : { strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (circ * value) / 100 }}
          transition={{ duration: D.chart, ease: E.out }}
        />
        <text x="70" y="64" textAnchor="middle" className="fill-foreground text-[18px] font-semibold">
          {value.toFixed(1)}%
        </text>
      </svg>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

export function CohortGrid({
  weeks,
  rows,
}: {
  weeks: string[];
  rows: Array<{ name: string; cells: Array<{ week: string; value: number }> }>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-separate border-spacing-[2px] text-[10px]">
        <thead>
          <tr>
            <th className="text-left font-normal text-muted-foreground">Client</th>
            {weeks.map((w) => (
              <th key={w} className="font-normal text-muted-foreground">
                {w}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td className="max-w-[140px] truncate pr-2 text-muted-foreground">{row.name}</td>
              {row.cells.map((c) => (
                <td
                  key={c.week}
                  title={`${row.name} · ${c.week} · ${c.value}% of peak activity`}
                  className="h-5 rounded-[2px]"
                  style={{ backgroundColor: `color-mix(in oklab, var(--chart-1) ${c.value}%, var(--surface-3))` }}
                />
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Waterfall({ steps }: { steps: Array<{ label: string; value: number }> }) {
  const reduced = usePrefersReducedMotion();
  const max = Math.max(...steps.map((s) => Math.abs(s.value)));
  return (
    <ul className="space-y-3">
      {steps.map((s, i) => (
        <li key={s.label}>
          <div className="flex items-baseline justify-between text-[11px]">
            <span className="font-medium">{s.label}</span>
            <span className={cn("tabular-nums", s.value < 0 ? "text-destructive" : "text-chart-3")}>
              {formatCurrency(s.value)}
            </span>
          </div>
          <div className="mt-1 h-3 overflow-hidden rounded-full bg-muted/60">
            <motion.div
              initial={reduced ? false : { width: 0 }}
              animate={{ width: `${(Math.abs(s.value) / max) * 100}%` }}
              transition={{ duration: D.chart, ease: E.out, delay: i * 0.08 }}
              className={cn("h-full rounded-full", s.value < 0 ? "bg-destructive/70" : "bg-chart-3")}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

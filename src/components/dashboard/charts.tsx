import { Link, useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";

import { ChartFrame } from "@/components/panels/charts";
import { formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const AXIS = {
  stroke: "var(--border)",
  tick: { fill: "var(--text-3)", fontSize: 10 },
  tickLine: false,
  axisLine: false,
} as const;

interface TipProps {
  active?: boolean;
  payload?: Array<{ name?: string | number; value?: number | string; color?: string; payload?: { color?: string } }>;
  label?: string | number;
  format?: (v: number) => string;
  /** Prefix for the heading, e.g. "Last bought" so the bin reads "Last bought 30-59 days ago". */
  heading?: (label: string | number | undefined) => string;
}

/** Tooltip in the same look as the shared chart tooltip, with a caller-supplied number format. */
function Tip({ active, payload, label, format = formatNumber, heading }: TipProps) {
  if (!active || !payload?.length) return null;
  const head = heading ? heading(label) : label;
  return (
    <div className="rounded-lg border border-border bg-popover/95 px-2.5 py-2 text-xs shadow-xl backdrop-blur">
      {head !== undefined && head !== "" && <p className="mb-1 font-medium">{head}</p>}
      <ul className="space-y-0.5">
        {payload.map((p, i) => (
          <li key={i} className="flex items-center gap-2 tabular-nums">
            <span className="size-2 rounded-full" style={{ backgroundColor: p.payload?.color ?? p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto font-medium">{typeof p.value === "number" ? format(p.value) : p.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------ Column chart ------------------------------ */

export interface ColumnDatum {
  label: string;
  value: number;
  color: string;
}

/** One-series column chart where each column carries its own colour. */
export function ColumnBars({
  data,
  name,
  height = 220,
  format = formatNumber,
  axisFormat,
  labels = false,
  heading,
}: {
  data: ColumnDatum[];
  name: string;
  height?: number;
  format?: (v: number) => string;
  axisFormat?: (v: number) => string;
  /** Print the value above each column. */
  labels?: boolean;
  heading?: (label: string | number | undefined) => string;
}) {
  return (
    <ChartFrame height={height}>
      <BarChart data={data} margin={{ top: labels ? 18 : 6, right: 6, left: -14, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} opacity={0.5} />
        <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={6} />
        <YAxis {...AXIS} width={44} tickFormatter={axisFormat ?? ((v: number) => formatNumber(v))} />
        <Tooltip content={<Tip format={format} heading={heading} />} cursor={{ fill: "var(--surface-3)", opacity: 0.35 }} />
        <Bar dataKey="value" name={name} radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.color} />
          ))}
          {labels && (
            <LabelList
              dataKey="value"
              position="top"
              fontSize={10}
              fill="var(--text-2)"
              formatter={(v: unknown) => format(Number(v))}
            />
          )}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

/* ------------------------------ Segment donut ------------------------------ */

export interface DonutDatum {
  key: string;
  label: string;
  value: number;
  color: string;
}

/**
 * Donut where every slice and every legend entry opens a filtered customer list.
 * The legend entries are real links, so the chart is usable from the keyboard.
 */
export function ClickableDonut({
  data,
  total,
  centerLabel,
  height = 200,
  hrefFor,
}: {
  data: DonutDatum[];
  total: number;
  centerLabel: string;
  height?: number;
  hrefFor: (key: string) => string;
}) {
  const navigate = useNavigate();
  return (
    <div>
      <div className="relative">
        <ChartFrame height={height}>
          <PieChart>
            <Tooltip content={<Tip />} />
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="60%"
              outerRadius="88%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
              onClick={(_: unknown, i: number) => {
                const d = data[i];
                if (d) navigate(hrefFor(d.key));
              }}
            >
              {data.map((d) => (
                <Cell key={d.key} fill={d.color} style={{ cursor: "pointer", outline: "none" }} />
              ))}
            </Pie>
          </PieChart>
        </ChartFrame>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xl font-semibold tabular-nums">{formatNumber(total)}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{centerLabel}</p>
        </div>
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
        {data.map((d) => (
          <li key={d.key}>
            <Link
              to={hrefFor(d.key)}
              className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11.5px] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="truncate">{d.label}</span>
              <span className="ml-auto font-medium tabular-nums text-foreground">{formatNumber(d.value)}</span>
              <span className="w-9 text-right tabular-nums">{formatPercent(total ? (d.value / total) * 100 : 0, 0)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Small coloured dot + label used wherever a segment name is shown. */
export function SegmentTag({ label, color, className }: { label: string; color: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {label}
    </span>
  );
}

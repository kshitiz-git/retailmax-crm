import * as React from "react";
import { Bar, BarChart, CartesianGrid, Cell, Tooltip, XAxis, YAxis } from "recharts";

import { ChartFrame } from "@/components/panels/charts";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCompact, formatNumber } from "@/lib/format";
import { REGIONS, SEGMENTS, type Customer, type Segment } from "@/lib/data/types";
import { AXIS, MoneyTip, SegmentChip } from "./bits";
import { SEG_COLOR, SEG_LABEL, segmentOf, type SegmentSource, type SegmentStats } from "./meta";

export function RevenueBySegment({ stats }: { stats: Record<Segment, SegmentStats> }) {
  const data = SEGMENTS.map((s) => ({ key: s, label: SEG_LABEL[s], Revenue: stats[s].revenue }));
  return (
    <ChartFrame height={250}>
      <BarChart data={data} margin={{ top: 6, right: 8, left: -6, bottom: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} opacity={0.5} />
        <XAxis dataKey="label" {...AXIS} />
        <YAxis {...AXIS} width={54} tickFormatter={(v: number) => `₹${formatCompact(v)}`} />
        <Tooltip content={<MoneyTip />} cursor={{ fill: "var(--surface-3)", opacity: 0.35 }} />
        <Bar dataKey="Revenue" radius={[5, 5, 0, 0]} isAnimationActive={false}>
          {data.map((d) => (
            <Cell key={d.key} fill={SEG_COLOR[d.key]} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

/** Segment (rows) x Region (columns) customer counts. Shade = share of the largest cell. */
export function SegmentRegionTable({ customers, source }: { customers: Customer[]; source: SegmentSource }) {
  const { grid, max, rowTotal, colTotal } = React.useMemo(() => {
    const g = Object.fromEntries(
      SEGMENTS.map((s) => [s, Object.fromEntries(REGIONS.map((r) => [r, 0]))]),
    ) as Record<Segment, Record<string, number>>;
    for (const c of customers) {
      const row = g[segmentOf(c, source)];
      row[c.region] = (row[c.region] ?? 0) + 1;
    }
    let mx = 1;
    const rt = {} as Record<Segment, number>;
    const ct = Object.fromEntries(REGIONS.map((r) => [r, 0])) as Record<string, number>;
    for (const s of SEGMENTS) {
      rt[s] = 0;
      for (const r of REGIONS) {
        const v = g[s][r]!;
        mx = Math.max(mx, v);
        rt[s] += v;
        ct[r] = (ct[r] ?? 0) + v;
      }
    }
    return { grid: g, max: mx, rowTotal: rt, colTotal: ct };
  }, [customers, source]);

  return (
    <div className="overflow-hidden rounded-[14px] border border-border">
      <Table className="text-[12.5px]">
        <TableHeader>
          <TableRow className="bg-surface-2/60 hover:bg-surface-2/60">
            <TableHead className="h-9">Segment</TableHead>
            {REGIONS.map((r) => (
              <TableHead key={r} className="h-9 text-right">
                {r}
              </TableHead>
            ))}
            <TableHead className="h-9 text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {SEGMENTS.map((s) => (
            <TableRow key={s}>
              <TableCell className="py-1.5">
                <SegmentChip segment={s} />
              </TableCell>
              {REGIONS.map((r) => {
                const v = grid[s][r]!;
                return (
                  <TableCell
                    key={r}
                    className="py-1.5 text-right tabular-nums"
                    style={{
                      backgroundColor: v
                        ? `color-mix(in oklab, ${SEG_COLOR[s]} ${Math.round(8 + 34 * (v / max))}%, transparent)`
                        : undefined,
                    }}
                  >
                    {formatNumber(v)}
                  </TableCell>
                );
              })}
              <TableCell className="py-1.5 text-right font-semibold tabular-nums">{formatNumber(rowTotal[s])}</TableCell>
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="py-1.5 font-medium">All</TableCell>
            {REGIONS.map((r) => (
              <TableCell key={r} className="py-1.5 text-right tabular-nums">
                {formatNumber(colTotal[r]!)}
              </TableCell>
            ))}
            <TableCell className="py-1.5 text-right tabular-nums">{formatNumber(customers.length)}</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

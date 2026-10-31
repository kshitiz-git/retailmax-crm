import * as React from "react";

import { SegmentBadge } from "@/components/customers/badges";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SEGMENTS, type Customer, type Segment } from "@/lib/data/types";
import { formatCurrency, formatNumber } from "@/lib/format";

const NUMERIC = [
  { key: "purchase_freq", label: "Purchase frequency", money: false },
  { key: "avg_order_value", label: "Average order value", money: true },
  { key: "last_purchase_days", label: "Days since last purchase", money: false },
  { key: "loyalty_points", label: "Loyalty points (dataset)", money: false },
] as const;

export function summarize(customers: Customer[]) {
  const n = customers.length;
  const ids = new Set<string>();
  const seg: Record<Segment, number> = { Champion: 0, Loyal: 0, New: 0, At_Risk: 0, Lost: 0 };
  let churned = 0;
  const stats = NUMERIC.map(() => ({ min: Infinity, max: -Infinity, sum: 0 }));
  for (const c of customers) {
    ids.add(c.customer_id);
    seg[c.computedSegment]++;
    if (c.churn_flag === 1) churned++;
    NUMERIC.forEach((col, i) => {
      const v = c[col.key];
      const s = stats[i]!;
      if (v < s.min) s.min = v;
      if (v > s.max) s.max = v;
      s.sum += v;
    });
  }
  return {
    n,
    duplicates: n - ids.size,
    seg,
    segmentsUsed: SEGMENTS.filter((s) => seg[s] > 0).length,
    churnRate: n ? (churned / n) * 100 : 0,
    columns: NUMERIC.map((col, i) => ({
      ...col,
      min: n ? stats[i]!.min : 0,
      max: n ? stats[i]!.max : 0,
      mean: n ? stats[i]!.sum / n : 0,
    })),
  };
}

export function DataQuality({ customers }: { customers: Customer[] }) {
  const q = React.useMemo(() => summarize(customers), [customers]);
  const fmt = (money: boolean, v: number) => (money ? formatCurrency(v) : formatNumber(v));

  return (
    <div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact label="Rows" value={formatNumber(q.n)} />
        <Fact label="Segments in use" value={`${q.segmentsUsed} of ${SEGMENTS.length}`} />
        <Fact label="Churn rate" value={`${q.churnRate.toFixed(1)}%`} sub="share with churn_flag = 1" />
        <Fact
          label="Duplicate IDs"
          value={formatNumber(q.duplicates)}
          sub={q.duplicates === 0 ? "every ID is unique" : "needs cleaning"}
        />
      </dl>

      <div className="mt-5 flex flex-wrap gap-2">
        {SEGMENTS.map((s) => (
          <span key={s} className="inline-flex items-center gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-xs">
            <SegmentBadge segment={s} />
            <span className="font-semibold tnum">{formatNumber(q.seg[s])}</span>
          </span>
        ))}
      </div>

      <div className="mt-5 overflow-x-auto rounded-lg border border-border">
        <Table className="min-w-[480px] text-[13px]">
          <TableHeader className="bg-surface-2/60">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-3 text-xs">Column</TableHead>
              <TableHead className="px-3 text-right text-xs">Min</TableHead>
              <TableHead className="px-3 text-right text-xs">Average</TableHead>
              <TableHead className="px-3 text-right text-xs">Max</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {q.columns.map((c) => (
              <TableRow key={c.key}>
                <TableCell className="px-3 py-2 font-medium">{c.label}</TableCell>
                <TableCell className="px-3 py-2 text-right tnum">{fmt(c.money, c.min)}</TableCell>
                <TableCell className="px-3 py-2 text-right tnum">{fmt(c.money, c.mean)}</TableCell>
                <TableCell className="px-3 py-2 text-right tnum">{fmt(c.money, c.max)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="mt-3 text-xs text-text-3">
        Segments here are the CRM-computed ones. Checked on load: ranges, allowed values and duplicate IDs.
      </p>
    </div>
  );
}

function Fact({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3.5 py-3">
      <dt className="text-[11px] text-text-3">{label}</dt>
      <dd className="metric mt-1.5 text-[22px]">{value}</dd>
      {sub && <p className="mt-1 text-[11px] text-text-3">{sub}</p>}
    </div>
  );
}

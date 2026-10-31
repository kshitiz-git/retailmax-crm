import { Link } from "react-router-dom";
import { ArrowRight, type LucideIcon } from "lucide-react";

import { SpotlightCard } from "@/components/motion/primitives";
import { IconTile, type IconTone } from "@/components/ui/icon-tile";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Customer } from "@/lib/data/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { SegmentTag } from "./charts";
import { SEGMENT_COLOR, segLabel, segmentOf, type DashboardData } from "./stats";

/* ------------------------------ Top customers ------------------------------ */

export function TopCustomersTable({ rows }: { rows: Customer[] }) {
  if (!rows.length) return <p className="py-6 text-center text-[13px] text-muted-foreground">No customers yet.</p>;
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-8 text-[11px]">#</TableHead>
          <TableHead className="text-[11px]">Customer</TableHead>
          <TableHead className="text-[11px]">Segment</TableHead>
          <TableHead className="hidden text-[11px] sm:table-cell">Region</TableHead>
          <TableHead className="hidden text-right text-[11px] md:table-cell">Orders</TableHead>
          <TableHead className="hidden text-right text-[11px] md:table-cell">Avg order</TableHead>
          <TableHead className="text-right text-[11px]">Total spend</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((c, i) => {
          const seg = segmentOf(c);
          return (
            <TableRow key={c.customer_id}>
              <TableCell className="tabular-nums text-muted-foreground">{i + 1}</TableCell>
              <TableCell>
                <Link
                  to={`/customers/${c.customer_id}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {c.customer_id}
                </Link>
              </TableCell>
              <TableCell>
                <SegmentTag label={segLabel(seg)} color={SEGMENT_COLOR[seg]} />
              </TableCell>
              <TableCell className="hidden text-muted-foreground sm:table-cell">{c.region}</TableCell>
              <TableCell className="hidden text-right tabular-nums md:table-cell">{formatNumber(c.purchase_freq)}</TableCell>
              <TableCell className="hidden text-right tabular-nums md:table-cell">{formatCurrency(c.avg_order_value)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatCurrency(c.monetary)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

/* ------------------------------ Needs attention ------------------------------ */

export function AttentionList({ rows }: { rows: Customer[] }) {
  if (!rows.length) {
    return (
      <p className="py-6 text-center text-[13px] text-muted-foreground">
        No Champion or Loyal customers to watch right now.
      </p>
    );
  }
  return (
    <ul className="-my-1 divide-y divide-border">
      {rows.map((c) => {
        const seg = segmentOf(c);
        const pct = Math.round(c.churnProb * 100);
        return (
          <li key={c.customer_id}>
            <Link
              to={`/customers/${c.customer_id}`}
              className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-surface-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2">
                  <span className="text-[13px] font-medium group-hover:text-primary">{c.customer_id}</span>
                  <SegmentTag label={segLabel(seg)} color={SEGMENT_COLOR[seg]} className="text-[11px] text-text-2" />
                </div>
                <p className="mt-0.5 truncate text-[11px] text-text-3">
                  Last bought {formatNumber(c.last_purchase_days)} days ago · {formatCurrency(c.monetary)} spend
                </p>
              </div>
              <div className="w-16 shrink-0 text-right">
                <p className="text-[13px] font-semibold tabular-nums text-danger">
                  {pct}%<span className="sr-only"> churn risk</span>
                </p>
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                  <div className="h-full rounded-full bg-danger" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------ Loyalty tier mix ------------------------------ */

export function TierBars({ tiers, total }: { tiers: DashboardData["tiers"]; total: number }) {
  const max = Math.max(1, ...tiers.map((t) => t.n));
  return (
    <ul className="space-y-6">
      {tiers.map((t) => (
        <li key={t.key}>
          <div className="flex items-baseline justify-between gap-2 text-[12px]">
            <span className="font-medium">
              {t.key} <span className="font-normal text-text-3">from {formatNumber(t.from)} pts</span>
            </span>
            <span className="tabular-nums text-muted-foreground">
              <span className="font-medium text-foreground">{formatNumber(t.n)}</span> ·{" "}
              {formatPercent(total ? (t.n / total) * 100 : 0, 0)}
            </span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full transition-[width] duration-700"
              style={{ width: `${(t.n / max) * 100}%`, backgroundColor: t.color }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------ Quick links ------------------------------ */

export interface QuickLinkItem {
  to: string;
  title: string;
  text: string;
  icon: LucideIcon;
  tone: IconTone;
}

export function QuickLinks({ items }: { items: QuickLinkItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((q) => (
        <Link key={q.to} to={q.to} className="group block rounded-[var(--r-xl)]">
          <SpotlightCard className="flex h-full items-center gap-3.5 p-4">
            <IconTile icon={q.icon} tone={q.tone} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-[14px] font-semibold tracking-tight">{q.title}</p>
              <p className="mt-0.5 truncate text-[12px] text-text-3">{q.text}</p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-text-3 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
          </SpotlightCard>
        </Link>
      ))}
    </div>
  );
}

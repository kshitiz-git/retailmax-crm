import { CalendarClock, Repeat, Wallet } from "lucide-react";

import { SpotlightCard } from "@/components/motion/primitives";
import { IconTile } from "@/components/ui/icon-tile";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { SEGMENTS, type Segment } from "@/lib/data/types";
import { SegmentChip } from "./bits";
import { SEG_RULE } from "./meta";

const DIMENSIONS = [
  {
    letter: "R",
    name: "Recency",
    icon: CalendarClock,
    measure: "Days since the last purchase",
    better: "Fewer days is better, so the scale is flipped: 5 = bought recently.",
  },
  {
    letter: "F",
    name: "Frequency",
    icon: Repeat,
    measure: "Number of purchases (purchase_freq)",
    better: "More purchases is better: 5 = buys most often.",
  },
  {
    letter: "M",
    name: "Monetary",
    icon: Wallet,
    measure: "Spend = purchases × average order value (INR)",
    better: "More spend is better: 5 = biggest spenders.",
  },
] as const;

export function RfmExplainer({ counts, sourceLabel }: { counts: Record<Segment, number>; sourceLabel: string }) {
  return (
    <SpotlightCard className="p-5 sm:p-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <h2 className="font-display text-[15px] font-semibold tracking-tight">How RFM works</h2>
          <p className="mt-1 text-[12.5px] text-muted-foreground">
            Three numbers describe how a customer buys. Each one is turned into a score from 1 to 5, and the scores
            decide the segment.
          </p>

          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {DIMENSIONS.map((d) => (
              <li key={d.letter} className="rounded-[14px] border border-border bg-surface-2/60 p-3.5">
                <div className="flex items-center gap-2.5">
                  <IconTile icon={d.icon} size="sm" tone="primary" />
                  <p className="text-[13px] font-semibold">
                    <span className="text-primary">{d.letter}</span> · {d.name}
                  </p>
                </div>
                <p className="mt-2.5 text-[12px] font-medium">{d.measure}</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground">{d.better}</p>
              </li>
            ))}
          </ul>

          <div className="mt-4 rounded-[14px] bg-surface-2 px-3.5 py-3 text-[12px] leading-relaxed text-muted-foreground">
            <p>
              <span className="font-medium text-foreground">Quintile scoring.</span> All customers are ranked on a
              dimension and split into 5 equal groups of about 20% each. A customer in the best group scores 5, the
              weakest group scores 1.
            </p>
            <div className="mt-2.5 flex items-center gap-1.5" aria-label="Scores 1 to 5, 5 is best">
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  className="flex h-7 flex-1 items-center justify-center rounded-md text-[12px] font-semibold tabular-nums text-foreground"
                  style={{ backgroundColor: `color-mix(in oklab, var(--chart-1) ${n * 17}%, var(--surface-3))` }}
                >
                  {n}
                </span>
              ))}
            </div>
            <div className="mt-1 flex justify-between text-[10.5px]">
              <span>weakest 20%</span>
              <span>best 20%</span>
            </div>
            <p className="mt-2.5">
              Example: score <span className="font-mono font-medium text-foreground">5-4-3</span> means a very recent,
              frequent buyer with mid-level spend, which is a Champion.
            </p>
          </div>
        </div>

        <div className="min-w-0">
          <h3 className="font-display text-[13px] font-semibold tracking-tight">The segment rule</h3>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Checked top to bottom, first match wins. The rule uses R and F; M ranks customer value.
          </p>
          <div className="mt-3 overflow-hidden rounded-[14px] border border-border">
            <Table className="text-[12.5px]">
              <TableHeader>
                <TableRow className="bg-surface-2/60 hover:bg-surface-2/60">
                  <TableHead className="h-9">Segment</TableHead>
                  <TableHead className="h-9">Rule</TableHead>
                  <TableHead className="h-9 text-right">
                    <span className="sr-only">Customers, </span>
                    {sourceLabel}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SEGMENTS.map((s) => (
                  <TableRow key={s}>
                    <TableCell className="py-2">
                      <SegmentChip segment={s} />
                    </TableCell>
                    <TableCell className="py-2 font-mono text-[11.5px] text-muted-foreground">{SEG_RULE[s]}</TableCell>
                    <TableCell className="py-2 text-right tabular-nums">{formatNumber(counts[s])}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </SpotlightCard>
  );
}

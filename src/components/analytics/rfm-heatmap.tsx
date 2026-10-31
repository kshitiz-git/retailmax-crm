import * as React from "react";

import { formatNumber, formatPercent } from "@/lib/format";
import { SEGMENTS, type Customer, type Segment } from "@/lib/data/types";
import { SEG_COLOR, SEG_LABEL, segmentOf, type SegmentSource } from "./meta";

interface Cell {
  r: number;
  f: number;
  count: number;
  dominant: Segment;
  by: Record<Segment, number>;
}

const SCORES = [1, 2, 3, 4, 5];

/** 5 x 5 grid of Recency score (rows) against Frequency score (columns). Cell colour = main segment in the cell. */
export function RfmHeatmap({ customers, source }: { customers: Customer[]; source: SegmentSource }) {
  const { cells, max } = React.useMemo(() => {
    const grid: Cell[] = [];
    for (let r = 1; r <= 5; r++)
      for (let f = 1; f <= 5; f++)
        grid.push({
          r,
          f,
          count: 0,
          dominant: "Lost",
          by: { Champion: 0, Loyal: 0, New: 0, At_Risk: 0, Lost: 0 },
        });
    for (const c of customers) {
      const cell = grid[(c.r - 1) * 5 + (c.f - 1)]!;
      cell.count++;
      cell.by[segmentOf(c, source)]++;
    }
    let mx = 1;
    for (const cell of grid) {
      mx = Math.max(mx, cell.count);
      let best: Segment = SEGMENTS[0];
      for (const s of SEGMENTS) if (cell.by[s] > cell.by[best]) best = s;
      cell.dominant = best;
    }
    return { cells: grid, max: mx };
  }, [customers, source]);

  const total = customers.length || 1;

  return (
    <div>
      <div className="grid grid-cols-[2.25rem_repeat(5,minmax(0,1fr))] gap-1 sm:gap-1.5">
        <span aria-hidden className="self-end pb-1 text-[10px] text-muted-foreground">
          R \ F
        </span>
        {SCORES.map((f) => (
          <span key={f} className="pb-1 text-center text-[10.5px] font-medium text-muted-foreground">
            F{f}
          </span>
        ))}

        {[5, 4, 3, 2, 1].map((r) => (
          <React.Fragment key={r}>
            <span className="flex items-center text-[10.5px] font-medium text-muted-foreground">R{r}</span>
            {SCORES.map((f) => {
              const cell = cells[(r - 1) * 5 + (f - 1)]!;
              const strength = 14 + 48 * (cell.count / max);
              const breakdown = SEGMENTS.filter((s) => cell.by[s] > 0)
                .map((s) => `${SEG_LABEL[s]} ${formatNumber(cell.by[s])}`)
                .join(", ");
              const text = `Recency score ${r}, frequency score ${f}: ${formatNumber(cell.count)} customers (${formatPercent(
                (cell.count / total) * 100,
              )})${breakdown ? `. ${breakdown}` : ""}`;
              return (
                <div
                  key={f}
                  role="img"
                  aria-label={text}
                  title={text}
                  className="flex h-12 flex-col items-center justify-center rounded-lg text-center transition-transform duration-150 hover:scale-[1.05] sm:h-[60px]"
                  style={{
                    backgroundColor: cell.count
                      ? `color-mix(in oklab, ${SEG_COLOR[cell.dominant]} ${strength}%, var(--surface))`
                      : "var(--surface-2)",
                  }}
                >
                  <span className="text-[13px] font-semibold tabular-nums leading-none sm:text-[14px]">
                    {formatNumber(cell.count)}
                  </span>
                  <span className="mt-1 text-[9.5px] leading-none text-muted-foreground tabular-nums">
                    {formatPercent((cell.count / total) * 100)}
                  </span>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      <div className="mt-3 flex justify-between text-[10.5px] text-muted-foreground">
        <span>R5 = bought most recently</span>
        <span>F5 = buys most often</span>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {SEGMENTS.map((s) => (
          <li key={s} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: SEG_COLOR[s] }} />
            {SEG_LABEL[s]}
          </li>
        ))}
        <li className="text-[11px] text-muted-foreground">Darker = more customers</li>
      </ul>
    </div>
  );
}

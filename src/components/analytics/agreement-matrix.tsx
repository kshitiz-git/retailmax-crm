import * as React from "react";

import { cn } from "@/lib/utils";
import { formatNumber, formatPercent } from "@/lib/format";
import { SEGMENTS, type Customer } from "@/lib/data/types";
import { SEG_COLOR, SEG_LABEL, isOriginalRow } from "./meta";

type Scope = "all" | "original" | "generated";

interface Agreement {
  n: number;
  agree: number;
  /** matrix[datasetLabelIndex][computedIndex] */
  matrix: number[][];
  /** Agreement expected if the two labels were independent (from the row and column totals). */
  chance: number;
}

const IDX = Object.fromEntries(SEGMENTS.map((s, i) => [s, i])) as Record<string, number>;

function agreement(list: Customer[]): Agreement {
  const matrix = SEGMENTS.map(() => SEGMENTS.map(() => 0));
  let agree = 0;
  for (const c of list) {
    const i = IDX[c.rfm_segment]!;
    const j = IDX[c.computedSegment]!;
    matrix[i]![j] = matrix[i]![j]! + 1;
    if (i === j) agree++;
  }
  const n = list.length;
  let chance = 0;
  if (n) {
    for (let k = 0; k < SEGMENTS.length; k++) {
      const row = matrix[k]!.reduce((s, v) => s + v, 0);
      const col = matrix.reduce((s, r) => s + r[k]!, 0);
      chance += (row / n) * (col / n);
    }
  }
  return { n, agree, matrix, chance };
}

const pct = (a: Agreement) => (a.n ? (a.agree / a.n) * 100 : 0);

const SCOPES: Array<{ key: Scope; label: string; hint: string }> = [
  { key: "all", label: "All rows", hint: "everything in the CRM" },
  { key: "original", label: "Original rows", hint: "C00001 to C00500, as supplied" },
  { key: "generated", label: "Generated rows", hint: "C00501 and above" },
];

/** Dataset rfm_segment (rows) against the segment the RFM rule computes (columns). */
export function AgreementMatrix({ customers }: { customers: Customer[] }) {
  const [scope, setScope] = React.useState<Scope>("all");

  const data = React.useMemo(() => {
    const orig: Customer[] = [];
    const gen: Customer[] = [];
    for (const c of customers) (isOriginalRow(c.customer_id) ? orig : gen).push(c);
    return { all: agreement(customers), original: agreement(orig), generated: agreement(gen) } satisfies Record<Scope, Agreement>;
  }, [customers]);

  const cur = data[scope];
  const rowTotals = cur.matrix.map((r) => r.reduce((s, v) => s + v, 0));
  const colTotals = SEGMENTS.map((_, j) => cur.matrix.reduce((s, r) => s + r[j]!, 0));
  const maxOff = Math.max(1, ...cur.matrix.flatMap((r, i) => r.filter((_, j) => i !== j)));

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        {SCOPES.map((s) => {
          const a = data[s.key];
          const active = s.key === scope;
          return (
            <button
              key={s.key}
              type="button"
              aria-pressed={active}
              onClick={() => setScope(s.key)}
              className={cn(
                "cursor-pointer rounded-[14px] border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                active ? "border-primary/60 bg-primary-soft" : "border-border bg-surface-2/60 hover:border-primary/30",
              )}
            >
              <p className="text-micro text-muted-foreground">{s.label}</p>
              <p className="metric mt-2 text-[21px] [overflow-wrap:anywhere] sm:text-[26px]">{a.n ? formatPercent(pct(a)) : "n/a"}</p>
              <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                {a.n
                  ? `${formatNumber(a.agree)} of ${formatNumber(a.n)} agree · chance level ${formatPercent(a.chance * 100, 0)}`
                  : "No rows in this group"}
              </p>
              <p className="mt-0.5 text-[10.5px] text-muted-foreground">{s.hint}</p>
            </button>
          );
        })}
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[460px] border-separate border-spacing-1 text-center text-[12px]">
          <caption className="sr-only">
            Dataset label (rows) against CRM-computed segment (columns), customer counts
          </caption>
          <thead>
            <tr>
              <th className="text-left text-[10.5px] font-normal text-muted-foreground">
                Dataset label ↓ · Computed →
              </th>
              {SEGMENTS.map((s) => (
                <th key={s} scope="col" className="pb-1 text-[11px] font-medium">
                  {SEG_LABEL[s]}
                </th>
              ))}
              <th scope="col" className="pb-1 text-[11px] font-normal text-muted-foreground">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {SEGMENTS.map((rs, i) => (
              <tr key={rs}>
                <th scope="row" className="pr-2 text-left text-[11px] font-medium">
                  <span className="mr-1.5 inline-block size-2 rounded-full align-middle" style={{ backgroundColor: SEG_COLOR[rs] }} />
                  {SEG_LABEL[rs]}
                </th>
                {SEGMENTS.map((cs, j) => {
                  const v = cur.matrix[i]![j]!;
                  const diag = i === j;
                  return (
                    <td
                      key={cs}
                      className={cn("h-10 rounded-md tabular-nums", diag && "font-semibold")}
                      style={{
                        backgroundColor: diag
                          ? `color-mix(in oklab, ${SEG_COLOR[rs]} ${v ? 38 : 8}%, transparent)`
                          : v
                            ? `color-mix(in oklab, var(--text-3) ${Math.round(6 + 26 * (v / maxOff))}%, transparent)`
                            : "var(--surface-2)",
                        boxShadow: diag ? `inset 0 0 0 1px ${SEG_COLOR[rs]}` : undefined,
                      }}
                      title={`Dataset says ${SEG_LABEL[rs]}, rule says ${SEG_LABEL[cs]}: ${formatNumber(v)} customers`}
                    >
                      {formatNumber(v)}
                    </td>
                  );
                })}
                <td className="text-[11.5px] text-muted-foreground tabular-nums">{formatNumber(rowTotals[i]!)}</td>
              </tr>
            ))}
            <tr>
              <th scope="row" className="pr-2 text-left text-[11px] font-normal text-muted-foreground">
                Total
              </th>
              {colTotals.map((v, j) => (
                <td key={j} className="pt-1 text-[11.5px] text-muted-foreground tabular-nums">
                  {formatNumber(v)}
                </td>
              ))}
              <td className="pt-1 text-[11.5px] font-medium tabular-nums">{formatNumber(cur.n)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">Outlined cells on the diagonal are agreements.</p>

      <div className="mt-4 space-y-2 rounded-[14px] bg-surface-2 px-3.5 py-3 text-[12.5px] leading-relaxed text-text-2">
        {data.all.n > 0 && pct(data.all) >= 95 ? (
          <>
            <p>
              In the loaded data the supplied label equals the CRM-computed segment for {formatPercent(pct(data.all))} of
              customers ({data.original.n ? `${formatPercent(pct(data.original))} of original rows` : "no original rows"}
              {data.generated.n ? `, ${formatPercent(pct(data.generated))} of generated rows` : ""}). That is by design:
              the cleaning step recomputed the segment column with the same RFM rule the CRM uses.
            </p>
            <p>
              HCL's own labels did not follow the rule. Measured when the data was cleaned (cleaning report, step R15):
              only 19.4% of the original 500 labels matched the rule, about the 20% that random labels would give. The raw
              labels are kept in dataset_original.csv.
            </p>
          </>
        ) : (
          <>
            <p>
              {data.original.n > 0
                ? `In the original rows the supplied labels match the RFM rule ${formatPercent(pct(data.original))} of the time. Random labels would match about ${formatPercent(data.original.chance * 100, 0)}. `
                : "No original rows are loaded. "}
              {data.generated.n > 0
                ? `The generated rows (C00501 and above) were built with the rule, so ${formatPercent(pct(data.generated))} of them agree.`
                : "There are no generated rows in the current data."}
            </p>
            <p>The CRM therefore recomputes every segment from recency and frequency and uses that for campaigns.</p>
          </>
        )}
      </div>
    </div>
  );
}

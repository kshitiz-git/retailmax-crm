import * as React from "react";
import { Link } from "react-router-dom";
import { Gem, Info, Megaphone, Percent, TrendingDown, Users } from "lucide-react";

import { EmptyState, PageHeader } from "@/components/shell/page-scaffold";
import { Panel, PanelGrid } from "@/components/panels/panel";
import { BarSeries, FunnelPanel } from "@/components/panels/charts";
import { Stagger, StaggerItem } from "@/components/motion/primitives";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCRM } from "@/lib/store";
import { AGE_GROUPS, REGIONS, SEGMENTS } from "@/lib/data/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { StatTile, type StatTileProps } from "@/components/dashboard/stat-tile";
import { pctOf, segLabel, segmentOf } from "@/components/dashboard/stats";
import {
  CAMPAIGN_STAGES,
  FREQ_BANDS,
  FREQUENT_MIN,
  FUNNEL_STAGES,
  HIGH_VALUE_QUANTILE,
  MIN_CELL,
  NO_FILTERS,
  REGULAR_MIN,
  REPEAT_MIN,
  aovByAgeAndBand,
  campaignSteps,
  campaignTotals,
  filterBase,
  filtersActive,
  highValueCutoff,
  stageCounts,
  stageCountsByRegion,
  toSteps,
  worstStep,
  type FunnelFilters,
} from "@/components/dashboard/funnel-stats";

/* ------------------------------ Filter select ------------------------------ */

function FilterSelect({
  id,
  label,
  value,
  allLabel,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  allLabel: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
}) {
  return (
    <div className="w-full space-y-1.5 sm:w-44">
      <Label htmlFor={id} className="text-[11px] text-muted-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const shortName = (key: string) => FUNNEL_STAGES.find((s) => s.key === key)?.short ?? key;

export default function Funnel() {
  const { customers, campaigns } = useCRM();
  const [filters, setFilters] = React.useState<FunnelFilters>(NO_FILTERS);
  const set = <K extends keyof FunnelFilters>(key: K, value: string) =>
    setFilters((f) => ({ ...f, [key]: value as FunnelFilters[K] }));

  /* Funnel maths. The high-value cut-off is measured on every customer so it stays fixed while filters change. */
  const cutoff = React.useMemo(() => highValueCutoff(customers), [customers]);
  const base = React.useMemo(() => filterBase(customers, filters), [customers, filters]);
  const rows = React.useMemo(
    () => (filters.region === "all" ? base : base.filter((c) => c.region === filters.region)),
    [base, filters.region],
  );
  const counts = React.useMemo(() => stageCounts(rows, cutoff), [rows, cutoff]);
  const steps = React.useMemo(() => toSteps(counts), [counts]);
  const worst = React.useMemo(() => worstStep(steps), [steps]);
  const byRegion = React.useMemo(() => stageCountsByRegion(base, cutoff), [base, cutoff]);
  const regionTotal = React.useMemo(
    () => byRegion.reduce((t, r) => t.map((v, i) => v + (r.counts[i] ?? 0)), new Array<number>(FUNNEL_STAGES.length).fill(0)),
    [byRegion],
  );

  /* Order value by age group x purchase frequency: follows region and segment, not the age filter (age is the axis). */
  const aovRows = React.useMemo(
    () =>
      customers.filter(
        (c) => (filters.region === "all" || c.region === filters.region) && (filters.segment === "all" || segmentOf(c) === filters.segment),
      ),
    [customers, filters.region, filters.segment],
  );
  const aov = React.useMemo(() => aovByAgeAndBand(aovRows), [aovRows]);
  const aovData = React.useMemo(
    () =>
      AGE_GROUPS.map((age) => {
        const row: Record<string, number | string> = { label: age };
        for (const b of FREQ_BANDS) {
          const cell = aov.cells.find((c) => c.age === age && c.band === b.key);
          if (cell && cell.agg.n >= MIN_CELL) row[`${b.key} orders`] = Math.round(cell.aov);
        }
        return row;
      }),
    [aov],
  );
  const aovKeys = FREQ_BANDS.map((b) => `${b.key} orders`);
  const aovHasData = aovData.some((r) => Object.keys(r).length > 1);

  /* Campaign funnel */
  const totals = React.useMemo(() => campaignTotals(campaigns), [campaigns]);
  const campSteps = React.useMemo(() => campaignSteps(totals), [totals]);

  /* Insights, all computed. */
  const insights = React.useMemo(() => {
    const all = counts[0] ?? 0;
    const retained = counts[5] ?? 0;
    const high = counts[4] ?? 0;

    const funnel = all
      ? worst && worst.drop > 0
        ? `The largest drop is at ${shortName(worst.key)}: ${formatPercent(worst.drop)} of customers do not continue. ${formatPercent(pctOf(retained, all))} of customers end up Retained.`
        : `${formatPercent(pctOf(retained, all))} of customers end up Retained.`
      : "";

    const steps2 = steps.filter((s) => s.key !== "all");
    const keep = steps2.reduce((b, s) => (s.conv > b.conv ? s : b), steps2[0]!);
    const stepsText = all
      ? `${shortName(keep.key)} is the strongest step, keeping ${formatPercent(keep.conv)} of the customers before it. ${formatPercent(pctOf(retained, high))} of high-value customers have not churned.`
      : "";

    const ranked = byRegion
      .filter((r) => (r.counts[0] ?? 0) > 0)
      .map((r) => ({ region: r.region, share: pctOf(r.counts[5] ?? 0, r.counts[0] ?? 0) }))
      .sort((a, b) => b.share - a.share);
    const region =
      ranked.length > 1
        ? `${ranked[0]!.region} turns the largest share of customers into Retained high-value buyers (${formatPercent(ranked[0]!.share)}); ${ranked[ranked.length - 1]!.region} the smallest (${formatPercent(ranked[ranked.length - 1]!.share)}).`
        : ranked.length === 1
          ? `${ranked[0]!.region} turns ${formatPercent(ranked[0]!.share)} of its customers into Retained high-value buyers.`
          : "";

    const bestCell = aov.cells.filter((c) => c.agg.n >= MIN_CELL).sort((a, b) => b.aov - a.aov)[0];
    const bands = aov.byBand.filter((b) => b.agg.n > 0).sort((a, b) => b.aov - a.aov);
    const aovText = bestCell
      ? `${bestCell.age} customers with ${bestCell.band} orders spend the most per order (${formatCurrency(bestCell.aov)}).${
          bands.length > 1
            ? ` By frequency band, ${bands[0]!.band} orders average ${formatCurrency(bands[0]!.aov)} and ${bands[bands.length - 1]!.band} orders ${formatCurrency(bands[bands.length - 1]!.aov)}.`
            : ""
        }`
      : "Not enough customers in each group to compare order value.";

    const cw = campSteps.slice(1).reduce<(typeof campSteps)[number] | undefined>((w, s) => (!w || s.drop > w.drop ? s : w), undefined);
    const campaign =
      totals.sent > 0
        ? `${formatPercent(pctOf(totals.converted, totals.sent))} of messages sent ended in a purchase.${cw && cw.drop > 0 ? ` The biggest loss is at ${cw.stage} (${formatPercent(cw.drop)}).` : ""}`
        : "";

    return { funnel, stepsText, region, aov: aovText, campaign };
  }, [counts, steps, worst, byRegion, aov, campSteps, totals]);

  const tiles: Array<StatTileProps & { key: string }> = [
    {
      key: "in-view",
      label: "Customers in view",
      value: counts[0] ?? 0,
      format: formatNumber,
      hint: filtersActive(filters) ? `of ${formatNumber(customers.length)} in the CRM` : "All customers in the CRM",
      chip: { text: `${formatNumber(counts[5] ?? 0)} reach Retained`, tone: "neutral" },
      icon: Users,
      hero: true,
    },
    {
      key: "conversion",
      label: "End-to-end conversion",
      value: pctOf(counts[5] ?? 0, counts[0] ?? 0),
      format: (v) => formatPercent(v),
      hint: "All customers to Retained",
      chip: { text: `${formatPercent(pctOf(counts[5] ?? 0, counts[4] ?? 0), 0)} of high value are retained`, tone: "neutral" },
      icon: Percent,
      tint: "mint",
    },
    {
      key: "drop",
      label: "Biggest drop-off",
      value: worst?.drop ?? 0,
      format: (v) => formatPercent(v),
      hint: worst ? `Lost at ${shortName(worst.key)}` : "No drop-off in view",
      chip: worst ? { text: `${formatNumber(worst.lost)} customers lost`, tone: "neutral" } : undefined,
      icon: TrendingDown,
      tint: "pink",
    },
    {
      key: "cutoff",
      label: "High-value cut-off",
      value: cutoff,
      format: formatCurrency,
      hint: "Total spend of the top 25% of all customers",
      chip: { text: `${formatNumber(counts[4] ?? 0)} customers in view are high value`, tone: "neutral" },
      icon: Gem,
      tint: "lilac",
    },
  ];

  const clear = () => setFilters(NO_FILTERS);
  const empty = (counts[0] ?? 0) === 0;

  if (!customers.length) {
    return (
      <>
        <PageHeader eyebrow="Overview" title="Sales funnel analytics" description="See where customers move on and where they fall away." />
        <EmptyState
          icon={Users}
          title="No customers yet"
          description="Import a customer CSV to build the lifecycle funnel."
          primaryLabel="Import customers"
          primaryTo="/data"
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Sales funnel analytics"
        description="See how customers move from a first purchase to a loyal, high-value relationship, and where they fall away."
      />

      <div className="mb-5 flex gap-3 rounded-xl border border-border bg-primary-soft p-4 text-[12.5px] leading-relaxed text-text-2">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <p>
          <span className="font-semibold text-foreground">How this funnel is defined.</span> The dataset records purchases per customer,
          not site visits or leads, so the funnel follows the customer lifecycle. Each step keeps only the customers who passed the step
          before it: all customers, then repeat buyers ({REPEAT_MIN}+ orders), regular ({REGULAR_MIN}+), frequent ({FREQUENT_MIN}+), high
          value (total spend of {formatCurrency(cutoff)} or more, the top {Math.round((1 - HIGH_VALUE_QUANTILE) * 100)}% of all
          customers) and retained (not churned).
        </p>
      </div>

      <div className="soft-card mb-5 flex flex-wrap items-end gap-4 p-4">
        <FilterSelect
          id="funnel-region"
          label="Region"
          value={filters.region}
          allLabel="All regions"
          options={REGIONS.map((r) => ({ value: r, label: r }))}
          onChange={(v) => set("region", v)}
        />
        <FilterSelect
          id="funnel-age"
          label="Age group"
          value={filters.age}
          allLabel="All ages"
          options={AGE_GROUPS.map((a) => ({ value: a, label: a }))}
          onChange={(v) => set("age", v)}
        />
        <FilterSelect
          id="funnel-segment"
          label="RFM segment"
          value={filters.segment}
          allLabel="All segments"
          options={SEGMENTS.map((s) => ({ value: s, label: segLabel(s) }))}
          onChange={(v) => set("segment", v)}
        />
        <div className="flex w-full flex-wrap items-center gap-3 sm:ml-auto sm:w-auto">
          <p className="text-[12px] text-muted-foreground" aria-live="polite">
            Showing <span className="font-semibold tabular-nums text-foreground">{formatNumber(rows.length)}</span> of{" "}
            <span className="tabular-nums">{formatNumber(customers.length)}</span> customers
          </p>
          {filtersActive(filters) && (
            <Button variant="ghost" size="sm" onClick={clear}>
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {empty ? (
        <EmptyState
          icon={Users}
          title="No customers match these filters"
          description="Try a different region, age group or segment to see the funnel."
          primaryLabel="Clear filters"
          onPrimary={clear}
        />
      ) : (
        <>
          <Stagger className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {tiles.map(({ key, ...tile }) => (
              <StaggerItem key={key} className="h-full">
                <StatTile {...tile} />
              </StaggerItem>
            ))}
          </Stagger>

          <div className="mt-5">
            <PanelGrid>
              <Panel
                title="Customer lifecycle funnel"
                subtitle="Customers who reach each step"
                insight={insights.funnel}
                span={2}
                help="Bar length is the share of all customers in view. The red note shows the step that loses the most customers."
              >
                <FunnelPanel stages={steps.map(({ stage, value, drop, pct }) => ({ stage, value, drop, pct }))} />
              </Panel>

              <Panel title="Step conversion" subtitle="Kept and lost at every step" insight={insights.stepsText}>
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[11px]">Step</TableHead>
                      <TableHead className="text-right text-[11px]">Kept</TableHead>
                      <TableHead className="text-right text-[11px]">Lost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {steps.slice(1).map((s) => (
                      <TableRow key={s.key}>
                        <TableCell className="text-[12.5px] font-medium">{shortName(s.key)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPercent(s.conv)}</TableCell>
                        <TableCell
                          className={cn(
                            "text-right tabular-nums",
                            worst?.key === s.key && s.drop > 0 ? "font-semibold text-danger" : "text-muted-foreground",
                          )}
                        >
                          {formatNumber(s.lost)} · {formatPercent(s.drop)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Panel>

              <Panel
                title="Funnel by region"
                subtitle={`Customers reaching each step and their share of the region${
                  filters.age !== "all" || filters.segment !== "all" ? " · follows age and segment filters" : ""
                }`}
                insight={insights.region}
                span={3}
              >
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-[11px]">Region</TableHead>
                      {FUNNEL_STAGES.map((s) => (
                        <TableHead key={s.key} className="text-right text-[11px]">
                          {s.short}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byRegion.map((r) => (
                      <TableRow key={r.region} className={cn(filters.region === r.region && "bg-primary-soft")}>
                        <TableCell className="font-medium">{r.region}</TableCell>
                        {r.counts.map((v, i) => {
                          const share = pctOf(v, r.counts[0] ?? 0);
                          return (
                            <TableCell
                              key={FUNNEL_STAGES[i]!.key}
                              className="text-right tabular-nums"
                              style={
                                i > 0 && v > 0
                                  ? { backgroundColor: `color-mix(in oklab, var(--chart-1) ${Math.round(share * 0.3)}%, transparent)` }
                                  : undefined
                              }
                            >
                              <span className="font-medium">{formatNumber(v)}</span>
                              {i > 0 && <span className="ml-1.5 text-[11px] text-muted-foreground">{formatPercent(share, 0)}</span>}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                    <TableRow className="border-t-2 bg-surface-2 font-semibold hover:bg-surface-2">
                      <TableCell>All regions</TableCell>
                      {regionTotal.map((v, i) => (
                        <TableCell key={FUNNEL_STAGES[i]!.key} className="text-right tabular-nums">
                          {formatNumber(v)}
                          {i > 0 && (
                            <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
                              {formatPercent(pctOf(v, regionTotal[0] ?? 0), 0)}
                            </span>
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableBody>
                </Table>
              </Panel>

              <Panel
                title="Average order value by age and purchase frequency"
                subtitle={`Orders per customer, four bands. Groups under ${MIN_CELL} customers are skipped`}
                insight={insights.aov}
                span={2}
              >
                {aovHasData ? (
                  <BarSeries data={aovData} keys={aovKeys} currency height={280} />
                ) : (
                  <p className="py-10 text-center text-[13px] text-muted-foreground">Not enough customers to plot order value.</p>
                )}
              </Panel>

              <Panel
                title="Campaign funnel"
                subtitle={totals.campaigns ? `${formatNumber(totals.campaigns)} campaign${totals.campaigns === 1 ? "" : "s"} with results` : "Sent to converted"}
                insight={insights.campaign || undefined}
                actions={
                  <Button asChild variant="ghost" size="sm">
                    <Link to="/campaigns">Open campaigns</Link>
                  </Button>
                }
              >
                {totals.sent > 0 ? (
                  <div className="space-y-5">
                    <FunnelPanel stages={campSteps} />
                    <dl className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-surface-2 px-3 py-2.5">
                        <dt className="text-micro text-text-3">Revenue</dt>
                        <dd className="metric mt-1.5 text-[18px]">{formatCurrency(totals.revenue)}</dd>
                      </div>
                      <div className="rounded-xl bg-surface-2 px-3 py-2.5">
                        <dt className="text-micro text-text-3">{CAMPAIGN_STAGES[4]} rate</dt>
                        <dd className="metric mt-1.5 text-[18px]">{formatPercent(pctOf(totals.converted, totals.sent))}</dd>
                      </div>
                    </dl>
                  </div>
                ) : (
                  <EmptyState
                    icon={Megaphone}
                    title="No campaign results yet"
                    description="Launch a campaign and its delivery, opens, clicks and purchases will appear here."
                    primaryLabel="Go to campaigns"
                    primaryTo="/campaigns"
                    className="py-10"
                  />
                )}
              </Panel>
            </PanelGrid>
          </div>
        </>
      )}
    </>
  );
}

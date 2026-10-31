import * as React from "react";
import { Info, Users } from "lucide-react";

import { PageHeader, EmptyState } from "@/components/shell/page-scaffold";
import { Panel, PanelGrid, SectionHeading } from "@/components/panels/panel";
import { DonutChart } from "@/components/panels/charts";
import { Stagger, StaggerItem } from "@/components/motion/primitives";
import { Segmented } from "@/components/analytics/bits";
import { RfmExplainer } from "@/components/analytics/rfm-explainer";
import { SegmentCard } from "@/components/analytics/segment-card";
import { RfmHeatmap } from "@/components/analytics/rfm-heatmap";
import { RevenueBySegment, SegmentRegionTable } from "@/components/analytics/segment-charts";
import { AgreementMatrix } from "@/components/analytics/agreement-matrix";
import { SEG_COLOR, SEG_LABEL, segmentStats, type SegmentSource } from "@/components/analytics/meta";
import { useCRM } from "@/lib/store";
import { formatCurrency, formatNumber } from "@/lib/format";
import { SEGMENTS, type Segment } from "@/lib/data/types";

const SOURCE_OPTIONS: Array<{ value: SegmentSource; label: string }> = [
  { value: "computed", label: "CRM-computed" },
  { value: "dataset", label: "Dataset label" },
];

export default function Segments() {
  const { customers } = useCRM();
  const [source, setSource] = React.useState<SegmentSource>("computed");

  const stats = React.useMemo(() => segmentStats(customers, source), [customers, source]);
  const counts = React.useMemo(
    () => Object.fromEntries(SEGMENTS.map((s) => [s, stats[s].count])) as Record<Segment, number>,
    [stats],
  );
  const donut = React.useMemo(
    () => SEGMENTS.map((s) => ({ key: SEG_LABEL[s], value: stats[s].count, color: SEG_COLOR[s] })),
    [stats],
  );
  const totalRevenue = React.useMemo(() => SEGMENTS.reduce((sum, s) => sum + stats[s].revenue, 0), [stats]);

  const top = React.useMemo(() => {
    const best = [...SEGMENTS].sort((a, b) => stats[b].revenue - stats[a].revenue)[0]!;
    return { seg: best, share: totalRevenue ? (stats[best].revenue / totalRevenue) * 100 : 0 };
  }, [stats, totalRevenue]);

  const agreement = React.useMemo(
    () => (customers.length ? customers.filter((c) => c.rfm_segment === c.computedSegment).length / customers.length : 1),
    [customers],
  );

  const sourceLabel = source === "computed" ? "CRM-computed" : "Dataset label";

  if (customers.length === 0) {
    return (
      <>
        <PageHeader eyebrow="AI / ML" title="RFM segmentation" />
        <EmptyState
          icon={Users}
          title="No customers to segment"
          description="Import a customer file and the segments appear here."
          primaryLabel="Go to Data"
          primaryTo="/data"
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="AI / ML"
        title="RFM segmentation"
        description="Customers grouped by Recency, Frequency and Monetary value, each with a plan for what to do next."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-muted-foreground">Segment source</span>
            <Segmented label="Segment source" value={source} onChange={setSource} options={SOURCE_OPTIONS} />
          </div>
        }
      />

      {source === "dataset" && (
        <div
          role="status"
          className="mb-6 flex items-start gap-2.5 rounded-[14px] border border-border bg-surface-2 px-4 py-3 text-[12.5px] leading-relaxed text-text-2"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>
            {agreement >= 0.99
              ? "Showing the labels from the dataset file. They equal the CRM-computed segments here because the cleaning step already recomputed them with the RFM rule, so both views match. See the data check at the bottom."
              : "Showing the labels exactly as they appear in the dataset file. They do not fully follow recency and frequency (see the data check at the bottom), so campaigns use the CRM-computed segments."}
          </p>
        </div>
      )}

      <Stagger className="space-y-8">
        <StaggerItem>
          <RfmExplainer counts={counts} sourceLabel={sourceLabel} />
        </StaggerItem>

        <StaggerItem>
          <SectionHeading
            eyebrow="Segments"
            title="Five groups, five plans"
            description={`${formatNumber(customers.length)} customers with ${formatCurrency(totalRevenue)} in total spend. ${SEG_LABEL[top.seg]} customers bring ${top.share.toFixed(0)}% of it.`}
          />
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {SEGMENTS.map((s) => (
              <SegmentCard key={s} stats={stats[s]} />
            ))}
          </ul>
          {source === "dataset" && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              The buttons open the CRM-computed segment of the same name.
            </p>
          )}
        </StaggerItem>

        <StaggerItem>
          <PanelGrid>
            <Panel
              span={2}
              title="Recency × Frequency map"
              subtitle="Colour = main segment in each cell"
              help="Rows are recency scores (5 = bought most recently), columns are frequency scores (5 = buys most often). Each cell counts the customers with that pair of scores."
              insight={
                source === "computed"
                  ? "Top-right is Champions, bottom-left is Lost. Moving a customer up or to the right is the goal of every campaign."
                  : agreement >= 0.99
                    ? "The dataset labels equal the rule here, so every cell keeps one colour."
                    : "With dataset labels the colours mix inside a cell: the label does not follow recency and frequency."
              }
            >
              <RfmHeatmap customers={customers} source={source} />
            </Panel>
            <Panel
              title="Revenue by segment"
              subtitle="Purchases × average order value"
              help="Sum of purchase_freq × avg_order_value for every customer in the segment."
            >
              <RevenueBySegment stats={stats} />
            </Panel>
          </PanelGrid>
        </StaggerItem>

        <StaggerItem>
          <PanelGrid>
            <Panel span={2} title="Segment by region" subtitle="Customer counts; darker = larger group">
              <SegmentRegionTable customers={customers} source={source} />
            </Panel>
            <Panel title="Customer mix" subtitle="Share of the base per segment">
              <DonutChart data={donut} height={200} centerValue={formatNumber(customers.length)} centerLabel="customers" />
            </Panel>
          </PanelGrid>
        </StaggerItem>

        <StaggerItem>
          <SectionHeading
            eyebrow="Data check"
            title="Do the supplied labels match the RFM rule?"
            description="The dataset ships with its own rfm_segment column. We compare it with the segment recomputed from recency and frequency."
          />
          <PanelGrid>
            <Panel span={3} title="Dataset label vs CRM-computed segment" subtitle="Customer counts; pick a group to compare">
              <AgreementMatrix customers={customers} />
            </Panel>
          </PanelGrid>
        </StaggerItem>
      </Stagger>
    </>
  );
}

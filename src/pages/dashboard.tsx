import * as React from "react";
import { Link } from "react-router-dom";
import {
  Gift,
  IndianRupee,
  Megaphone,
  PieChart as PieChartIcon,
  ShieldAlert,
  ShoppingCart,
  TrendingDown,
  UserCheck,
  Users,
  HeartHandshake,
  Star,
} from "lucide-react";

import { EmptyState, PageHeader } from "@/components/shell/page-scaffold";
import { Panel, PanelGrid, SectionHeading } from "@/components/panels/panel";
import { BarSeries } from "@/components/panels/charts";
import { Stagger, StaggerItem } from "@/components/motion/primitives";
import { Button } from "@/components/ui/button";
import { useCRM } from "@/lib/store";
import { churnModel } from "@/lib/ml/churn";
import { formatCompact, formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { ClickableDonut, ColumnBars } from "@/components/dashboard/charts";
import { StatTile, type StatTileProps } from "@/components/dashboard/stat-tile";
import { AttentionList, QuickLinks, TierBars, TopCustomersTable, type QuickLinkItem } from "@/components/dashboard/lists";
import {
  ACTIVE_DAYS,
  aovOf,
  avgPointsOf,
  avgSpendOf,
  churnPctOf,
  computeDashboard,
  dashboardInsights,
  diffChip,
  pctDiff,
  pctOf,
  type Agg,
  type DashboardData,
} from "@/components/dashboard/stats";

function buildTiles(d: DashboardData): Array<StatTileProps & { key: string }> {
  const champion = d.segments.find((s) => s.key === "Champion")!.agg;
  const modelNote = churnModel.trained_at === "placeholder" ? "Model not trained yet" : "Model risk band: High";
  /** Percent difference of a metric for one group against all customers; null for an empty group. */
  const vsAll = (g: Agg, f: (a: Agg) => number) => (g.n ? pctDiff(f(g), f(d.all)) : null);

  return [
    {
      key: "customers",
      label: "Total customers",
      value: d.n,
      format: formatNumber,
      hint: "Anonymised IDs in the CRM",
      chip: { text: `${formatPercent(pctOf(d.active.n, d.n), 0)} bought in the last ${ACTIVE_DAYS} days`, tone: "neutral" },
      icon: Users,
      hero: true,
      to: "/customers",
    },
    {
      key: "revenue",
      label: "Total revenue",
      value: d.all.revenue,
      format: (v) => `₹${formatCompact(v)}`,
      title: formatCurrency(d.all.revenue),
      hint: `${formatNumber(d.all.orders)} orders in total`,
      chip: { text: `Champions bring ${formatPercent(pctOf(champion.revenue, d.all.revenue), 0)} of it`, tone: "neutral" },
      icon: IndianRupee,
      tint: "mint",
      to: "/segments",
    },
    {
      key: "aov",
      label: "Average order value",
      value: aovOf(d.all),
      format: formatCurrency,
      hint: "Revenue divided by total orders",
      chip: diffChip("Champions vs all", vsAll(champion, aovOf)),
      icon: ShoppingCart,
      tint: "lilac",
      to: "/funnel",
    },
    {
      key: "churn",
      label: "Churn rate",
      value: churnPctOf(d.all),
      format: (v) => formatPercent(v),
      hint: `${formatNumber(d.all.churned)} of ${formatNumber(d.n)} customers churned`,
      chip: diffChip("active customers vs all", d.active.n ? churnPctOf(d.active) - churnPctOf(d.all) : null, {
        higherIsGood: false,
        unit: "pts",
      }),
      icon: TrendingDown,
      tint: "pink",
      to: "/churn",
    },
    {
      key: "active",
      label: "Active customers",
      value: d.active.n,
      format: formatNumber,
      hint: `Last purchase within ${ACTIVE_DAYS} days`,
      chip: diffChip("avg spend vs all", vsAll(d.active, avgSpendOf)),
      icon: UserCheck,
      tint: "cream",
      to: "/customers",
    },
    {
      key: "points",
      label: "Avg loyalty points",
      value: avgPointsOf(d.all),
      format: formatNumber,
      hint: "Current balance per customer",
      chip: diffChip("Champions vs all", vsAll(champion, avgPointsOf)),
      icon: Star,
      tint: "lilac",
      to: "/loyalty",
    },
    {
      key: "consent",
      label: "Consented customers",
      value: pctOf(d.consented.n, d.n),
      format: (v) => formatPercent(v),
      hint: `${formatNumber(d.consented.n)} customers can be contacted`,
      chip: { text: `${formatNumber(d.notConsented.n)} customers have not opted in`, tone: "neutral" },
      icon: HeartHandshake,
      tint: "mint",
      to: "/privacy",
    },
    {
      key: "risk",
      label: "High churn risk",
      value: d.highRisk,
      format: formatNumber,
      hint: modelNote,
      chip: { text: `${formatPercent(pctOf(d.highRisk, d.n), 1)} of all customers`, tone: "neutral" },
      icon: ShieldAlert,
      tint: "pink",
      to: "/churn",
    },
  ];
}

export default function Dashboard() {
  const { customers, campaigns } = useCRM();

  const d = React.useMemo(() => computeDashboard(customers), [customers]);
  const insights = React.useMemo(() => dashboardInsights(d), [d]);
  const tiles = React.useMemo(() => buildTiles(d), [d]);

  const donutData = React.useMemo(
    () => d.segments.map((s) => ({ key: s.key, label: s.label, value: s.agg.n, color: s.color })),
    [d],
  );
  const regionData = React.useMemo(
    () => d.regions.map((r) => ({ label: r.key, Revenue: Math.round(r.agg.revenue) })),
    [d],
  );
  const churnData = React.useMemo(
    () => d.segments.map((s) => ({ label: s.label, value: churnPctOf(s.agg), color: s.color })),
    [d],
  );

  const quickLinks = React.useMemo<QuickLinkItem[]>(() => {
    const seg = (k: string) => d.segments.find((s) => s.key === k)!.agg.n;
    return [
      {
        to: "/segments",
        title: "RFM segments",
        text: `${formatPercent(pctOf(seg("Champion"), d.n), 0)} Champions · ${formatPercent(pctOf(seg("At_Risk"), d.n), 0)} At Risk`,
        icon: PieChartIcon,
        tone: "primary",
      },
      {
        to: "/churn",
        title: "Churn prediction",
        text: `${formatNumber(d.highRisk)} customers at high risk`,
        icon: ShieldAlert,
        tone: "danger",
      },
      {
        to: "/campaigns",
        title: "Campaigns",
        text: `${formatNumber(campaigns.length)} ${campaigns.length === 1 ? "campaign" : "campaigns"} · ${formatNumber(d.consented.n)} reachable`,
        icon: Megaphone,
        tone: "accent",
      },
      {
        to: "/loyalty",
        title: "Loyalty",
        text: `${formatCompact(d.totalPoints)} points in circulation`,
        icon: Gift,
        tone: "warning",
      },
    ];
  }, [d, campaigns.length]);

  if (!customers.length) {
    return (
      <>
        <PageHeader eyebrow="Overview" title="RetailMax CRM" description="Know every customer, keep the best ones, win back the rest." />
        <EmptyState
          title="No customers yet"
          description="Import a customer CSV to see revenue, segments, churn risk and the sales funnel here."
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
        title="RetailMax CRM"
        description="Know every customer, keep the best ones, win back the rest. Every number below is calculated from your customer data."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/customers">Browse customers</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/campaigns">
                <Megaphone /> Plan a campaign
              </Link>
            </Button>
          </>
        }
      />

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
            title="Customers by RFM segment"
            subtitle="Click a slice to open that segment"
            insight={insights.segments}
            help="Segments come from Recency and Frequency quintile scores. Champions bought recently and often; Lost customers did neither."
          >
            <ClickableDonut
              data={donutData}
              total={d.n}
              centerLabel="customers"
              hrefFor={(k) => `/customers?segment=${encodeURIComponent(k)}`}
            />
          </Panel>

          <Panel title="Revenue by region" subtitle="Total spend per region" insight={insights.region}>
            <BarSeries data={regionData} keys={["Revenue"]} currency height={285} />
          </Panel>

          <Panel
            title="Churn rate by segment"
            subtitle="Share of customers who churned"
            insight={insights.churn}
            help="Churn rate is the number of customers with churn flag 1 divided by all customers in that segment."
          >
            <ColumnBars
              data={churnData}
              name="Churn rate"
              height={285}
              format={(v) => formatPercent(v)}
              axisFormat={(v) => `${v}%`}
              labels
            />
          </Panel>

          <Panel
            title="Recency distribution"
            subtitle="Customers by days since last purchase, 30-day bins"
            insight={insights.recency}
            span={2}
          >
            <ColumnBars
              data={d.recency}
              name="Customers"
              height={240}
              heading={(l) => `Last bought ${l} days ago`}
            />
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-chart-3" /> Active: 0-89 days
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-chart-1" /> Cooling: 90-179 days
              </li>
              <li className="flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-chart-4" /> Lapsing: 180+ days
              </li>
            </ul>
          </Panel>

          <Panel
            title="Loyalty tier mix"
            subtitle="Customers per tier"
            insight={insights.tier}
            actions={
              <Button asChild variant="ghost" size="sm">
                <Link to="/loyalty">Open loyalty</Link>
              </Button>
            }
          >
            <TierBars tiers={d.tiers} total={d.n} />
          </Panel>

          <Panel
            title="Top 10 customers by spend"
            subtitle="Click an ID to open the customer profile"
            insight={insights.top}
            span={2}
          >
            <TopCustomersTable rows={d.top} />
          </Panel>

          <Panel
            title="Needs attention"
            subtitle="Champions and Loyal at high churn risk"
            insight={insights.attention}
            actions={
              <Button asChild variant="ghost" size="sm">
                <Link to="/churn">All at risk</Link>
              </Button>
            }
          >
            <AttentionList rows={d.attention} />
          </Panel>
        </PanelGrid>
      </div>

      <SectionHeading eyebrow="Explore" title="Go deeper" description="Each module opens with the same customer data you see here." />
      <QuickLinks items={quickLinks} />
    </>
  );
}

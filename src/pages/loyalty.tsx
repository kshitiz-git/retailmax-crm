import * as React from "react";
import { Coins, Gift, Users, Wallet } from "lucide-react";

import { BulkAward } from "@/components/loyalty/bulk-award";
import { CloseToTier, type NearTierRow } from "@/components/loyalty/close-to-tier";
import { Ledger } from "@/components/loyalty/ledger";
import { ProgrammeRules } from "@/components/loyalty/programme-rules";
import {
  NEAR_TIER_WINDOW,
  POINT_VALUE_INR,
  TIER_COLOR,
  nextTier,
  pointsToRupees,
} from "@/components/loyalty/rules";
import { StatTile } from "@/components/loyalty/stat-tile";
import { Stagger, StaggerItem } from "@/components/motion/primitives";
import { BarSeries, DonutChart } from "@/components/panels/charts";
import { Panel, PanelGrid } from "@/components/panels/panel";
import { EmptyState, PageHeader } from "@/components/shell/page-scaffold";
import { TIER_THRESHOLDS } from "@/lib/data/derive";
import { LOYALTY_TIERS, SEGMENTS, type LoyaltyTier, type Segment } from "@/lib/data/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { useCRM } from "@/lib/store";

const segLabel = (s: string) => s.replace("_", " ");
const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

export default function Loyalty() {
  const { customers } = useCRM();

  const stats = React.useMemo(() => {
    const members: Record<LoyaltyTier, number> = { Bronze: 0, Silver: 0, Gold: 0, Platinum: 0 };
    const segPoints: Record<Segment, number> = { Champion: 0, Loyal: 0, New: 0, At_Risk: 0, Lost: 0 };
    const near: NearTierRow[] = [];
    let total = 0;
    for (const c of customers) {
      total += c.points;
      members[c.tier]++;
      segPoints[c.computedSegment] += c.points;
      const next = nextTier(c.tier);
      if (next) {
        const need = TIER_THRESHOLDS[next] - c.points;
        if (need > 0 && need <= NEAR_TIER_WINDOW) near.push({ customer: c, next, need });
      }
    }
    near.sort((a, b) => a.need - b.need);
    return { members, segPoints, near, total };
  }, [customers]);

  const n = customers.length;
  const { members, segPoints, near, total } = stats;

  const tierData = LOYALTY_TIERS.map((t) => ({ key: t, value: members[t], color: TIER_COLOR[t] }));
  const segData = SEGMENTS.map((s) => ({ label: segLabel(s), Points: segPoints[s] }));
  const topSeg = SEGMENTS.reduce<Segment>((best, s) => (segPoints[s] > segPoints[best] ? s : best), SEGMENTS[0]);
  const topTierShare = pct(members.Gold + members.Platinum, n);

  return (
    <div>
      <PageHeader
        eyebrow="Engagement"
        title="Loyalty"
        description="Customers earn points on every purchase and move up tiers as their balance grows. Track what is owed, reward groups and nudge people over the line."
      />

      {n === 0 ? (
        <EmptyState
          icon={Gift}
          title="No customers yet"
          description="Import a customer CSV on the Data page to start tracking loyalty points."
          primaryLabel="Open Data page"
          primaryTo="/data"
        />
      ) : (
        <div className="space-y-6">
          <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StaggerItem>
              <StatTile
                label="Points outstanding"
                value={total}
                format={formatNumber}
                sub={`across ${formatNumber(n)} members`}
                icon={Coins}
              />
            </StaggerItem>
            <StaggerItem>
              <StatTile
                label="Liability"
                value={pointsToRupees(total)}
                format={formatCurrency}
                sub={`if every point is redeemed at ₹${POINT_VALUE_INR.toFixed(2)}`}
                icon={Wallet}
                tone="warning"
              />
            </StaggerItem>
            <StaggerItem>
              <StatTile
                label="Average points"
                value={total / n}
                format={formatNumber}
                sub="per member"
                icon={Users}
                tone="accent"
              />
            </StaggerItem>
            <StaggerItem>
              <StatTile
                label="Close to next tier"
                value={near.length}
                format={formatNumber}
                sub={`within ${NEAR_TIER_WINDOW} points`}
                icon={Gift}
                tone="success"
              />
            </StaggerItem>
          </Stagger>

          <PanelGrid>
            <Panel
              span={2}
              title="Programme rules"
              subtitle="How points are earned, what they are worth and what each tier gets"
            >
              <ProgrammeRules members={members} />
            </Panel>

            <Panel
              title="Members by tier"
              subtitle={`${formatNumber(n)} members`}
              insight={`Gold and Platinum make up ${formatPercent(topTierShare, 0)} of members.`}
            >
              <DonutChart data={tierData} height={200} centerValue={formatNumber(n)} centerLabel="members" />
            </Panel>

            <Panel
              title="Points by segment"
              subtitle="Where the outstanding points sit"
              insight={`${segLabel(topSeg)} customers hold ${formatPercent(pct(segPoints[topSeg], total), 0)} of all points.`}
            >
              <BarSeries data={segData} keys={["Points"]} colorByIndex height={230} />
            </Panel>

            <Panel
              span={2}
              title="Award points in bulk"
              subtitle="Reward a segment or tier in one step"
              help="Every credit lands in the ledger with your reason, so it can be audited later."
            >
              <BulkAward customers={customers} />
            </Panel>

            <Panel
              span={3}
              title="Close to the next tier"
              subtitle={`${formatNumber(near.length)} customers within ${NEAR_TIER_WINDOW} points, closest first`}
              help="A nudge adds bonus points and counts as a message, so it needs marketing consent."
            >
              <CloseToTier rows={near} />
            </Panel>

            <Panel span={3} title="Points ledger" subtitle="Every award, nudge and campaign reward, newest first">
              <Ledger />
            </Panel>
          </PanelGrid>
        </div>
      )}
    </div>
  );
}

import * as React from "react";
import { UserX } from "lucide-react";

import { PageHeader, EmptyState } from "@/components/shell/page-scaffold";
import { Panel, PanelGrid, SectionHeading } from "@/components/panels/panel";
import { Stagger, StaggerItem } from "@/components/motion/primitives";
import { usePrefersReducedMotion } from "@/hooks/use-motion-prefs";
import { StatTile } from "@/components/analytics/bits";
import {
  ComparisonTable,
  ConfusionMatrix,
  FeatureImportance,
  MetricTiles,
  ModelFacts,
  ModelNotTrained,
  SignalNote,
} from "@/components/analytics/model-card";
import { PredictedVsActual, RiskBandTiles, RiskHistogram } from "@/components/analytics/risk-charts";
import { AtRiskTable } from "@/components/analytics/at-risk-table";
import { WhatIfSimulator } from "@/components/analytics/what-if";
import { RISK_COLOR, isPlaceholderModel, prettyModelName } from "@/components/analytics/meta";
import { churnModel } from "@/lib/ml/churn";
import { useCRM } from "@/lib/store";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type { RiskBand } from "@/lib/data/types";

export default function Churn() {
  const { customers, byId } = useCRM();
  const reduced = usePrefersReducedMotion();
  const [band, setBand] = React.useState<RiskBand | "all">("all");
  const trained = !isPlaceholderModel();

  const summary = React.useMemo(() => {
    let high = 0;
    let highSpend = 0;
    let reachable = 0;
    let probSum = 0;
    for (const c of customers) {
      probSum += c.churnProb;
      if (c.riskBand === "High") {
        high++;
        highSpend += c.monetary;
        if (c.consent) reachable++;
      }
    }
    return { high, highSpend, reachable, avg: customers.length ? probSum / customers.length : 0 };
  }, [customers]);

  const pickBand = React.useCallback(
    (b: RiskBand) => {
      setBand(b);
      document.getElementById("at-risk")?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    },
    [reduced],
  );

  if (customers.length === 0) {
    return (
      <>
        <PageHeader eyebrow="AI / ML" title="Churn prediction" />
        <EmptyState
          icon={UserX}
          title="No customers to score"
          description="Import a customer file and every customer gets a churn probability."
          primaryLabel="Go to Data"
          primaryTo="/data"
        />
      </>
    );
  }

  const total = customers.length;

  return (
    <>
      <PageHeader
        eyebrow="AI / ML"
        title="Churn prediction"
        description="A model scores every customer's chance of leaving, explains why, and lets you test what would change it."
      />

      <Stagger className="space-y-8">
        <StaggerItem>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="High-risk customers"
              value={formatNumber(summary.high)}
              sub={`${formatPercent((summary.high / total) * 100)} of ${formatNumber(total)}`}
              accent={RISK_COLOR.High}
            />
            <StatTile
              label="Spend at risk"
              value={formatCurrency(summary.highSpend)}
              sub="Purchases × order value, high-risk group"
            />
            <StatTile
              label="Reachable now"
              value={formatNumber(summary.reachable)}
              sub="High-risk and marketing consent given"
            />
            <StatTile
              label="Average churn risk"
              value={formatPercent(summary.avg * 100)}
              sub={`Model: ${prettyModelName(churnModel.model)}`}
            />
          </div>
        </StaggerItem>

        <StaggerItem>
          <SectionHeading
            eyebrow="1 · The model"
            title="How well does it predict?"
            description="Trained offline in Python on historical customers, then exported as numbers that the browser uses to score each customer."
          />
          <PanelGrid>
            <Panel span={3} title="Churn model" subtitle="Scored in your browser, no server">
              <div className="space-y-4">
                <ModelFacts />
                {trained ? <MetricTiles /> : <ModelNotTrained />}
                <SignalNote />
              </div>
            </Panel>
            {trained && (
              <>
                <Panel
                  title="Confusion matrix"
                  subtitle="Held-out test customers"
                  help="Rows are what really happened, columns are what the model predicted. The green cells are correct calls."
                >
                  <ConfusionMatrix />
                </Panel>
                <Panel
                  title="Model comparison"
                  subtitle="Same train and test split"
                  help="The model marked In use scores every customer in this CRM."
                >
                  <ComparisonTable />
                </Panel>
                <Panel
                  title="Feature importance"
                  subtitle="What the model looks at most"
                  help="A larger bar means that input moves the churn score more."
                >
                  <FeatureImportance />
                </Panel>
              </>
            )}
          </PanelGrid>
        </StaggerItem>

        <StaggerItem>
          <SectionHeading
            eyebrow="2 · Try it"
            title="What-if simulator"
            description="Pick a customer or the median profile, move the sliders, and the model re-scores instantly."
          />
          <PanelGrid>
            <Panel span={3} title="Change the inputs, watch the risk" subtitle="Live model, nothing is saved">
              <WhatIfSimulator customers={customers} byId={byId} />
            </Panel>
          </PanelGrid>
        </StaggerItem>

        <StaggerItem>
          <SectionHeading
            eyebrow="3 · The base"
            title="Where does the risk sit?"
            description="Every customer gets a probability between 0% and 100%. High risk starts at the model's decision threshold."
          />
          <PanelGrid>
            <Panel title="Risk bands" subtitle="Click a band to list its customers">
              <RiskBandTiles customers={customers} active={band} onPick={pickBand} />
            </Panel>
            <Panel span={2} title="Risk distribution" subtitle="Customers per churn-probability bucket">
              <RiskHistogram customers={customers} />
            </Panel>
            <Panel
              span={3}
              title="Predicted vs actual churn"
              subtitle="Mean model probability vs churn flag, by segment"
              insight="Bars of similar height mean the model's probabilities are honest on average for that group."
            >
              <PredictedVsActual customers={customers} />
            </Panel>
          </PanelGrid>
        </StaggerItem>

        <StaggerItem>
          <div id="at-risk" className="scroll-mt-24">
            <SectionHeading
              eyebrow="4 · Act on it"
              title="At-risk customers"
              description="Highest churn probability first. Open a customer, export the list, or start a win-back campaign."
            />
            <PanelGrid>
              <Panel span={3} title="Customers to save" subtitle="Filter, export or target">
                <AtRiskTable customers={customers} band={band} onBandChange={setBand} />
              </Panel>
            </PanelGrid>
          </div>
        </StaggerItem>
      </Stagger>
    </>
  );
}

import * as React from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CalendarClock,
  Coins,
  Receipt,
  SearchX,
  ShoppingBag,
  StickyNote,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

import { ConsentBadge, RiskBadge, SegmentBadge, TierBadge } from "@/components/customers/badges";
import { ChurnExplainer, ChurnGauge } from "@/components/customers/churn-parts";
import { PointsDialog } from "@/components/customers/points-dialog";
import { RfmBlock, SimilarList, Timeline, TierProgress, type TimelineItem } from "@/components/customers/profile-parts";
import { nextAction } from "@/components/customers/recommend";
import { Stagger, StaggerItem } from "@/components/motion/primitives";
import { Panel, PanelGrid } from "@/components/panels/panel";
import { EmptyState } from "@/components/shell/page-scaffold";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Customer } from "@/lib/data/types";
import { formatCurrency, formatNumber } from "@/lib/format";
import { churnModel } from "@/lib/ml/churn";
import { useCRM } from "@/lib/store";

const NOTE_MAX = 500;

function StatTile({ icon, label, value, sub }: { icon: LucideIcon; label: string; value: string; sub: string }) {
  return (
    <StaggerItem className="soft-card flex items-start gap-3 p-4">
      <IconTile icon={icon} tone="primary" />
      <div className="min-w-0">
        <p className="text-micro text-text-2">{label}</p>
        <p className="metric mt-2 truncate text-[24px]">{value}</p>
        <p className="mt-1.5 text-[11.5px] text-text-3">{sub}</p>
      </div>
    </StaggerItem>
  );
}

function Profile({ c }: { c: Customer }) {
  const crm = useCRM();
  const [pointsOpen, setPointsOpen] = React.useState(false);
  const [note, setNote] = React.useState("");

  const action = React.useMemo(() => nextAction(c), [c]);

  const timeline = React.useMemo<TimelineItem[]>(() => {
    const id = c.customer_id;
    const items: TimelineItem[] = [];
    for (const n of crm.notes) if (n.customer_id === id) items.push({ id: n.id, kind: "note", at: n.at, title: "Note added", detail: n.text });
    for (const t of crm.loyaltyTxns)
      if (t.customer_id === id)
        items.push({
          id: t.id,
          kind: "points",
          at: t.at,
          title: `${t.points >= 0 ? "+" : "−"}${formatNumber(Math.abs(t.points))} points`,
          detail: t.reason,
          tone: t.points >= 0 ? "up" : "down",
        });
    for (const e of crm.consentLog)
      if (e.customer_id === id)
        items.push({
          id: e.id,
          kind: "consent",
          at: e.at,
          title: e.granted ? "Marketing consent given" : "Marketing consent withdrawn",
          detail: `Source: ${e.source}`,
          tone: e.granted ? "up" : "down",
        });
    return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  }, [crm.notes, crm.loyaltyTxns, crm.consentLog, c.customer_id]);

  const similar = React.useMemo(
    () =>
      crm.customers
        .filter((o) => o.customer_id !== c.customer_id && o.computedSegment === c.computedSegment && o.region === c.region)
        .map((o) => ({ o, d: Math.abs(o.monetary - c.monetary) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 5)
        .map((x) => x.o),
    [crm.customers, c],
  );

  const onConsent = (granted: boolean) => {
    crm.setConsent(c.customer_id, granted, "Customer 360");
    toast.success(granted ? "Marketing consent recorded" : "Marketing consent withdrawn", {
      description: granted ? `${c.customer_id} can now receive campaigns.` : `${c.customer_id} is excluded from campaigns.`,
    });
  };

  const noteText = note.trim();
  const addNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText) return;
    crm.addNote(c.customer_id, noteText.slice(0, NOTE_MAX));
    setNote("");
    toast.success("Note added", { description: `Saved to ${c.customer_id}'s history.` });
  };

  const ActionIcon = action.icon;

  return (
    <div className="pb-10">
      <Link
        to="/customers"
        className="inline-flex items-center gap-1.5 rounded-sm text-[13px] text-text-2 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" /> All customers
      </Link>

      <div className="mt-3 mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-micro text-primary">Customer 360</p>
          <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight">{c.customer_id}</h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <SegmentBadge segment={c.computedSegment} />
            <TierBadge tier={c.tier} />
            <RiskBadge band={c.riskBand} />
            <ConsentBadge granted={c.consent} />
            <span className="text-xs text-text-3">
              {c.region} · age {c.age_group}
            </span>
          </div>
        </div>
        <Button onClick={() => setPointsOpen(true)}>
          <Coins /> Award / redeem points
        </Button>
      </div>

      <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile icon={Wallet} label="Lifetime value" value={formatCurrency(c.monetary)} sub="orders × average order value" />
        <StatTile icon={ShoppingBag} label="Orders" value={formatNumber(c.purchase_freq)} sub="purchases to date" />
        <StatTile icon={Receipt} label="Avg order value" value={formatCurrency(c.avg_order_value)} sub="per order" />
        <StatTile
          icon={CalendarClock}
          label="Last purchase"
          value={`${formatNumber(c.last_purchase_days)} days`}
          sub="since the most recent order"
        />
      </Stagger>

      <PanelGrid className="mt-5">
        <Panel title="Loyalty" subtitle="Points balance and progress to the next tier">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="metric text-[32px]">{formatNumber(c.points)}</p>
              <p className="mt-1.5 text-[11.5px] text-text-3">
                points · dataset {formatNumber(c.loyalty_points)}
                {c.points !== c.loyalty_points &&
                  ` ${c.points > c.loyalty_points ? "+" : "−"} ${formatNumber(Math.abs(c.points - c.loyalty_points))} adjusted`}
              </p>
            </div>
            <TierBadge tier={c.tier} className="mb-1" />
          </div>
          <div className="mt-5">
            <TierProgress points={c.points} tier={c.tier} />
          </div>
        </Panel>

        <Panel
          title="Churn probability"
          subtitle="Logistic regression model, scored in your browser"
          help="The chance this customer stops buying, from purchase count, order value, recency, points, age group and region."
        >
          <ChurnGauge prob={c.churnProb} band={c.riskBand} />
          <div className="mt-3 flex items-center justify-center gap-2 text-xs text-text-2">
            <RiskBadge band={c.riskBand} />
            {c.churn_flag === 1 && <span>Marked as churned in the dataset</span>}
          </div>
        </Panel>

        <Panel title="Recommended next action" subtitle="Rule-based from segment, risk and consent">
          <div className="flex items-start gap-3">
            <IconTile icon={ActionIcon} tone={action.tone} size="lg" />
            <div className="min-w-0">
              <p className="font-display text-[16px] font-semibold tracking-tight">{action.title}</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-2">{action.why}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {action.actionable ? (
              <Button asChild size="sm" variant="outline">
                <Link to="/campaigns">Open campaigns</Link>
              </Button>
            ) : (
              <p className="text-xs text-text-3">Once the customer agrees, switch consent on under Actions.</p>
            )}
          </div>
        </Panel>

        <Panel title="RFM profile" subtitle="Recency, frequency and monetary scores (5 = best)">
          <RfmBlock c={c} />
        </Panel>

        <Panel
          span={2}
          title="Why this churn risk"
          subtitle="The five factors that move this customer's score most"
          help="Each bar is that factor's share of the churn score. Red pushes towards churn, green pushes away."
        >
          <ChurnExplainer customer={c} />
        </Panel>

        <Panel title="Actions" subtitle="Changes are saved and logged">
          <div className="space-y-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Label htmlFor="consent-switch" className="text-[13px]">
                  Marketing consent
                </Label>
                <p className="mt-1 text-xs leading-relaxed text-text-3">
                  Campaigns reach only customers who agreed (DPDP Act 2023).
                </p>
              </div>
              <Switch id="consent-switch" checked={c.consent} onCheckedChange={onConsent} />
            </div>

            <div className="border-t border-border pt-5">
              <p className="text-[13px] font-medium">Loyalty points</p>
              <p className="mt-1 text-xs text-text-3">Balance {formatNumber(c.points)} points.</p>
              <Button variant="outline" size="sm" className="mt-2.5" onClick={() => setPointsOpen(true)}>
                <Coins /> Award / redeem points
              </Button>
            </div>

            <form onSubmit={addNote} className="border-t border-border pt-5">
              <Label htmlFor="note-text" className="text-[13px]">
                Add a note
              </Label>
              <Textarea
                id="note-text"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
                placeholder="e.g. Prefers WhatsApp offers on weekends"
                rows={3}
                className="mt-2 resize-y"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[11px] text-text-3 tnum">
                  {note.length}/{NOTE_MAX}
                </span>
                <Button type="submit" size="sm" disabled={!noteText}>
                  <StickyNote /> Save note
                </Button>
              </div>
            </form>
          </div>
        </Panel>

        <Panel span={2} title="Activity" subtitle="Notes, point changes and consent changes, newest first">
          <Timeline items={timeline} />
        </Panel>

        <Panel
          span={3}
          title="Similar customers"
          subtitle={`Same segment and region, closest lifetime value to ${formatCurrency(c.monetary)}`}
        >
          <SimilarList list={similar} region={c.region} segment={c.computedSegment} />
        </Panel>
      </PanelGrid>

      {churnModel.trained_at === "placeholder" && (
        <p className="mt-5 text-center text-xs text-text-3">Churn model not trained yet. Scores shown are placeholders.</p>
      )}

      <PointsDialog customer={c} open={pointsOpen} onOpenChange={setPointsOpen} />
    </div>
  );
}

export default function CustomerDetail() {
  const { id = "" } = useParams<{ id: string }>();
  const { byId } = useCRM();
  const c = byId.get(id) ?? byId.get(id.toUpperCase());

  if (!c) {
    return (
      <EmptyState
        icon={SearchX}
        title="Customer not found"
        description={`There is no customer with ID "${id}". The ID may have a typo, or the record was erased.`}
        primaryLabel="Back to customers"
        primaryTo="/customers"
      />
    );
  }
  // key resets note text and dialog state when moving between customers.
  return <Profile key={c.customer_id} c={c} />;
}

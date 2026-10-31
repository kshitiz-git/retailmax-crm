import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronDown, Layers, Megaphone, Plus, ShieldCheck, TrendingUp, Users, Wallet } from "lucide-react";
import { toast } from "sonner";

import { CampaignCard } from "@/components/campaigns/campaign-card";
import { CampaignDetailSheet } from "@/components/campaigns/campaign-detail";
import { CampaignWizard, type SubmitMode } from "@/components/campaigns/campaign-wizard";
import { Chip } from "@/components/campaigns/chip";
import { filtersOf, matchesAudience, summarizeAudience } from "@/components/campaigns/audience";
import {
  EMPTY_DRAFT,
  TEMPLATES,
  draftFromCampaign,
  draftFromParams,
  type CampaignDraft,
} from "@/components/campaigns/meta";
import { simulateCampaign } from "@/components/campaigns/simulate";
import { StatTile } from "@/components/loyalty/stat-tile";
import { IconTile } from "@/components/ui/icon-tile";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState, PageHeader } from "@/components/shell/page-scaffold";
import { Stagger, StaggerItem } from "@/components/motion/primitives";
import type { Campaign, CampaignStatus } from "@/lib/data/types";
import { formatCurrency, formatIST, formatNumber, formatPercent } from "@/lib/format";
import { useCRM } from "@/lib/store";

/** How long a launched campaign shows "Running" before the simulated results land. */
const RUN_MS = 1500;

/** Campaign ids whose simulated run is already scheduled. Module-level so it survives leaving and re-opening the page. */
const inflight = new Set<string>();

type WizardState = { key: number; open: boolean; initial: CampaignDraft; step: 1 | 2 | 3 };

export default function Campaigns() {
  const crm = useCRM();
  const { campaigns, customers } = crm;
  const [params, setParams] = useSearchParams();
  const [wiz, setWiz] = React.useState<WizardState>({ key: 0, open: false, initial: EMPTY_DRAFT, step: 1 });
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [statusFilter, setStatusFilter] = React.useState<CampaignStatus | "All">("All");

  // The finish step runs from a timer, so it reads the store through a ref instead of a stale closure.
  const crmRef = React.useRef(crm);
  crmRef.current = crm;

  const openWizard = React.useCallback((initial: CampaignDraft, step: 1 | 2 | 3 = 1) => {
    setWiz((w) => ({ key: w.key + 1, open: true, initial, step }));
  }, []);

  // Deep link from Segments / Churn: /campaigns?segment=Champion&risk=High opens the wizard with that audience.
  React.useEffect(() => {
    const seed = draftFromParams(params.get("segment"), params.get("risk"));
    if (!seed) return;
    openWizard(seed, 1);
    setParams({}, { replace: true });
  }, [params, setParams, openWizard]);

  /** Complete a Running campaign: simulate over the CONSENTED audience, store results, award points. */
  const finishRun = React.useCallback((id: string) => {
    const store = crmRef.current;
    inflight.delete(id);
    const c = store.campaigns.find((x) => x.id === id);
    if (!c || c.status !== "Running") return;

    // Audience is recomputed now: consent may have changed since the draft was saved.
    const filters = filtersOf(c);
    const matching = store.customers.filter((x) => matchesAudience(x, filters));
    const consented = matching.filter((x) => x.consent);
    if (consented.length === 0) {
      store.updateCampaign(id, { status: "Draft", audienceSize: matching.length, consentedSize: 0 });
      toast.error(`"${c.name}" was not sent`, { description: "No one in this audience has given consent." });
      return;
    }

    const out = simulateCampaign(c, consented);
    store.updateCampaign(id, {
      status: "Completed",
      results: out.results,
      audienceSize: matching.length,
      consentedSize: consented.length,
    });
    if (out.awards.length) store.adjustPointsBulk(out.awards, `Campaign: ${c.name}`);
    store.log(
      "campaign.complete",
      `${c.name}: ${out.results.converted} of ${out.results.sent} consented customers converted`,
    );
    toast.success(`"${c.name}" completed`, {
      description: `${formatNumber(out.results.sent)} sent · ${formatNumber(out.results.converted)} bought · ${formatCurrency(out.results.revenue)} revenue · ${formatNumber(out.results.pointsAwarded)} points awarded`,
    });
  }, []);

  // Any campaign in "Running" gets its results after RUN_MS. Also recovers a run that was cut short by a reload.
  React.useEffect(() => {
    for (const c of campaigns) {
      if (c.status !== "Running" || inflight.has(c.id)) continue;
      inflight.add(c.id);
      window.setTimeout(() => finishRun(c.id), RUN_MS);
    }
  }, [campaigns, finishRun]);

  const handleSubmit = (draft: CampaignDraft, mode: SubmitMode, scheduledFor?: string) => {
    const summary = summarizeAudience(customers, draft, draft.channel, draft.discountPct);
    const status: CampaignStatus = mode === "launch" ? "Running" : mode === "schedule" ? "Scheduled" : "Draft";
    const created = crm.addCampaign({
      ...draft,
      status,
      scheduledFor,
      audienceSize: summary.matching,
      consentedSize: summary.consented.length,
    });
    setWiz((w) => ({ ...w, open: false }));
    if (mode === "launch") {
      // Let the wizard finish closing before the results sheet opens (two modal layers at once can fight over focus).
      window.setTimeout(() => setSelectedId(created.id), 220);
      toast.success(`Launching "${created.name}"`, {
        description: `${formatNumber(summary.consented.length)} consented customers. ${formatNumber(summary.excluded)} left out for no consent.`,
      });
    } else if (mode === "schedule") {
      toast.success(`"${created.name}" scheduled`, {
        description: scheduledFor ? `Planned for ${formatIST(scheduledFor, false)}.` : undefined,
      });
    } else {
      toast.success(`Draft "${created.name}" saved`);
    }
  };

  const launch = (c: Campaign) => {
    crm.updateCampaign(c.id, { status: "Running", scheduledFor: undefined });
    crm.log("campaign.launch", c.name);
    setSelectedId(c.id);
    toast.success(`Launching "${c.name}"`);
  };

  const selected = campaigns.find((c) => c.id === selectedId) ?? null;

  const totals = React.useMemo(() => {
    let sent = 0;
    let converted = 0;
    let revenue = 0;
    let done = 0;
    for (const c of campaigns) {
      if (!c.results) continue;
      done++;
      sent += c.results.sent;
      converted += c.results.converted;
      revenue += c.results.revenue;
    }
    return { sent, converted, revenue, done };
  }, [campaigns]);

  const statusCounts = React.useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of campaigns) m[c.status] = (m[c.status] ?? 0) + 1;
    return m;
  }, [campaigns]);

  const visible = statusFilter === "All" ? campaigns : campaigns.filter((c) => c.status === statusFilter);

  return (
    <div>
      <PageHeader
        eyebrow="Engagement"
        title="Campaigns"
        description="Pick an audience, add an offer, and launch. Only customers who gave marketing consent are contacted."
        actions={
          <>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Layers className="size-4" />
                  Templates
                  <ChevronDown className="size-4 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel>Start from a template</DropdownMenuLabel>
                {TEMPLATES.map((t) => (
                  <DropdownMenuItem key={t.id} onSelect={() => openWizard(t.draft, 3)} className="items-start">
                    <t.icon className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium">{t.title}</span>
                      <span className="block text-[11.5px] text-muted-foreground">{t.blurb}</span>
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={() => openWizard(EMPTY_DRAFT)}>
              <Plus className="size-4" />
              Create campaign
            </Button>
          </>
        }
      />

      {campaigns.length === 0 ? (
        <div className="space-y-8">
          <EmptyState
            icon={Megaphone}
            title="No campaigns yet"
            description="Create your first campaign, or pick one of the ready-made templates below. Consent is checked for you."
            primaryLabel="Create campaign"
            onPrimary={() => openWizard(EMPTY_DRAFT)}
          />
          <section aria-label="Templates">
            <p className="text-micro text-primary">One click to start</p>
            <h2 className="text-h1 mt-1.5">Templates</h2>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openWizard(t.draft, 3)}
                  className="soft-card soft-card-hover flex flex-col items-start gap-3 p-5 text-left"
                >
                  <IconTile icon={t.icon} tone="primary" />
                  <span className="font-display text-[15px] font-semibold tracking-tight">{t.title}</span>
                  <span className="text-[12.5px] leading-relaxed text-text-2">{t.blurb}</span>
                  <span className="mt-auto text-[12px] font-medium text-primary">Use this template</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-6">
          <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StaggerItem>
              <StatTile
                label="Campaigns"
                value={campaigns.length}
                format={formatNumber}
                sub={`${totals.done} completed`}
                icon={Megaphone}
              />
            </StaggerItem>
            <StaggerItem>
              <StatTile
                label="Customers reached"
                value={totals.sent}
                format={formatNumber}
                sub="consented only"
                icon={Users}
                tone="accent"
              />
            </StaggerItem>
            <StaggerItem>
              <StatTile
                label="Buyers"
                value={totals.converted}
                format={formatNumber}
                sub={totals.sent > 0 ? `${formatPercent((totals.converted / totals.sent) * 100)} conversion` : "no results yet"}
                icon={TrendingUp}
                tone="success"
              />
            </StaggerItem>
            <StaggerItem>
              <StatTile
                label="Revenue"
                value={totals.revenue}
                format={formatCurrency}
                sub="simulated, after discounts"
                icon={Wallet}
                tone="warning"
              />
            </StaggerItem>
          </Stagger>

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by status">
            <Chip active={statusFilter === "All"} count={campaigns.length} onClick={() => setStatusFilter("All")}>
              All
            </Chip>
            {(["Running", "Scheduled", "Draft", "Completed"] as const).map((s) =>
              statusCounts[s] ? (
                <Chip key={s} active={statusFilter === s} count={statusCounts[s]} onClick={() => setStatusFilter(s)}>
                  {s}
                </Chip>
              ) : null,
            )}
            <p className="ml-auto flex items-center gap-1.5 text-[11.5px] text-text-3">
              <ShieldCheck className="size-3.5 text-success" aria-hidden />
              Results are simulated from fixed channel and segment rates.
            </p>
          </div>

          {visible.length === 0 ? (
            <p className="rounded-[14px] bg-surface-2 px-4 py-8 text-center text-[13px] text-text-2">
              No {statusFilter.toLowerCase()} campaigns right now.{" "}
              <button type="button" className="font-medium text-primary hover:underline" onClick={() => setStatusFilter("All")}>
                Show all campaigns
              </button>
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
              {visible.map((c) => (
                <CampaignCard key={c.id} campaign={c} onOpen={() => setSelectedId(c.id)} onLaunch={() => launch(c)} />
              ))}
            </div>
          )}
        </div>
      )}

      <CampaignWizard
        key={wiz.key}
        open={wiz.open}
        onOpenChange={(o) => setWiz((w) => ({ ...w, open: o }))}
        initial={wiz.initial}
        initialStep={wiz.step}
        customers={customers}
        onSubmit={handleSubmit}
      />

      <CampaignDetailSheet
        campaign={selected}
        onClose={() => setSelectedId(null)}
        onLaunch={launch}
        onDuplicate={(c) => {
          setSelectedId(null);
          window.setTimeout(() => openWizard(draftFromCampaign(c, `${c.name} (copy)`), 1), 220);
        }}
        onDelete={(c) => {
          crm.deleteCampaign(c.id);
          setSelectedId(null);
          toast.success(`"${c.name}" deleted`);
        }}
      />
    </div>
  );
}

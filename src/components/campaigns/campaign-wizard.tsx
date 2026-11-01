import * as React from "react";
import { ArrowLeft, ArrowRight, CalendarClock, Check, Rocket, Save, ShieldCheck, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { AGE_GROUPS, REGIONS, SEGMENTS, type CampaignChannel, type Customer } from "@/lib/data/types";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { summarizeAudience } from "./audience";
import { Chip } from "./chip";
import {
  CHANNELS,
  CHANNEL_ICON,
  MAX_DISCOUNT,
  POINT_MULTIPLIERS,
  RISK_BANDS,
  segLabel,
  type CampaignDraft,
} from "./meta";

export type SubmitMode = "draft" | "schedule" | "launch";
type Step = 1 | 2 | 3;

const STEPS = ["Details", "Audience", "Review"] as const;

const toggleIn = <T,>(list: readonly T[], v: T): T[] => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const isoDay = (d: Date) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD in local time

function Stepper({ step }: { step: Step }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Campaign steps">
      {STEPS.map((label, i) => {
        const n = (i + 1) as Step;
        const done = n < step;
        const current = n === step;
        return (
          <li key={label} className="flex flex-1 items-center gap-2" aria-current={current ? "step" : undefined}>
            <span
              className={cn(
                "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold tabular-nums",
                done && "bg-success text-primary-foreground",
                current && "bg-primary text-primary-foreground",
                !done && !current && "bg-surface-3 text-text-3",
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden /> : n}
            </span>
            <span className={cn("text-[12.5px] font-medium", current ? "text-foreground" : "text-text-3")}>{label}</span>
            {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-[12px] text-danger">
          {error}
        </p>
      ) : (
        hint && <p className="text-[11.5px] text-text-3">{hint}</p>
      )}
    </div>
  );
}

function Stat({ label, value, tone, sub }: { label: string; value: string; tone?: "warn" | "ok"; sub?: string }) {
  return (
    <div className="min-w-0 rounded-[14px] bg-surface-2 px-3.5 py-3">
      <p className="text-[10.5px] uppercase leading-tight tracking-wide text-text-3">{label}</p>
      <p
        className={cn(
          "metric mt-1.5 text-[20px]",
          tone === "warn" && "text-warning",
          tone === "ok" && "text-success",
          !tone && "text-foreground",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-[11px] leading-snug text-text-3">{sub}</p>}
    </div>
  );
}

export function CampaignWizard({
  open,
  onOpenChange,
  initial,
  initialStep = 1,
  customers,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: CampaignDraft;
  initialStep?: Step;
  customers: readonly Customer[];
  onSubmit: (draft: CampaignDraft, mode: SubmitMode, scheduledFor?: string) => void;
}) {
  const [step, setStep] = React.useState<Step>(initialStep);
  const [draft, setDraft] = React.useState<CampaignDraft>(initial);
  const [showErrors, setShowErrors] = React.useState(false);

  const today = React.useMemo(() => isoDay(new Date()), []);
  const [date, setDate] = React.useState(() => isoDay(new Date(Date.now() + 86_400_000)));
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= today;

  const patch = (p: Partial<CampaignDraft>) => setDraft((d) => ({ ...d, ...p }));

  // How many customers sit in each filter option (whole base, not the current selection).
  const counts = React.useMemo(() => {
    const seg: Record<string, number> = {};
    const reg: Record<string, number> = {};
    const age: Record<string, number> = {};
    const risk: Record<string, number> = {};
    for (const c of customers) {
      seg[c.computedSegment] = (seg[c.computedSegment] ?? 0) + 1;
      reg[c.region] = (reg[c.region] ?? 0) + 1;
      age[c.age_group] = (age[c.age_group] ?? 0) + 1;
      risk[c.riskBand] = (risk[c.riskBand] ?? 0) + 1;
    }
    return { seg, reg, age, risk };
  }, [customers]);

  // Live audience: recomputed on every filter change. One pass over the customers, no rendering of rows.
  const summary = React.useMemo(
    () =>
      summarizeAudience(
        customers,
        { segments: draft.segments, regions: draft.regions, ageGroups: draft.ageGroups, riskBands: draft.riskBands },
        draft.channel,
        draft.discountPct,
      ),
    [customers, draft.segments, draft.regions, draft.ageGroups, draft.riskBands, draft.channel, draft.discountPct],
  );

  const nameOk = draft.name.trim().length > 0;
  const segOk = draft.segments.length > 0;
  const reachOk = summary.consented.length > 0;
  const consentShare = summary.matching > 0 ? (summary.consented.length / summary.matching) * 100 : 0;

  const audienceError = !segOk
    ? "Pick at least one segment."
    : !reachOk
      ? summary.matching === 0
        ? "No customers match these filters. Widen the audience."
        : "Nobody in this audience has given consent, so nobody can be contacted. Widen the audience."
      : undefined;

  const goNext = () => {
    if (step === 1) {
      if (!nameOk) return setShowErrors(true);
      setShowErrors(false);
      setStep(2);
    } else if (step === 2) {
      if (audienceError) return setShowErrors(true);
      setShowErrors(false);
      setStep(3);
    }
  };

  const submit = (mode: SubmitMode) => {
    if (!nameOk || audienceError) {
      setShowErrors(true);
      setStep(!nameOk ? 1 : 2);
      return;
    }
    if (mode === "schedule" && !dateOk) {
      setShowErrors(true);
      return;
    }
    const clean = { ...draft, name: draft.name.trim(), offer: draft.offer.trim() };
    onSubmit(clean, mode, mode === "schedule" ? new Date(`${date}T09:00:00`).toISOString() : undefined);
  };

  const ChannelIcon = CHANNEL_ICON[draft.channel];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] max-w-2xl gap-5 overflow-y-auto p-5 sm:p-6">
        <DialogHeader className="pr-6">
          <DialogTitle className="font-display">Create campaign</DialogTitle>
          <DialogDescription>
            Three short steps. Only customers who gave marketing consent are ever contacted.
          </DialogDescription>
        </DialogHeader>

        <Stepper step={step} />

        {step === 1 && (
          <div className="space-y-5">
            <Field
              label="Campaign name"
              htmlFor="cmp-name"
              error={showErrors && !nameOk ? "Give the campaign a name." : undefined}
            >
              <Input
                id="cmp-name"
                value={draft.name}
                maxLength={60}
                placeholder="e.g. Diwali VIP reward"
                aria-invalid={showErrors && !nameOk}
                onChange={(e) => patch({ name: e.target.value })}
              />
            </Field>

            <div className="space-y-1.5">
              <Label id="cmp-channel-label">Channel</Label>
              <div role="group" aria-labelledby="cmp-channel-label" className="flex flex-wrap gap-2">
                {CHANNELS.map((ch) => {
                  const I = CHANNEL_ICON[ch];
                  return (
                    <Chip
                      key={ch}
                      active={draft.channel === ch}
                      onClick={() => patch({ channel: ch as CampaignChannel })}
                      icon={<I className="size-3.5" aria-hidden />}
                    >
                      {ch}
                    </Chip>
                  );
                })}
              </div>
            </div>

            <Field label="Offer text" htmlFor="cmp-offer" hint="What customers read. Keep it short and friendly.">
              <Textarea
                id="cmp-offer"
                rows={3}
                maxLength={200}
                value={draft.offer}
                placeholder="e.g. Thank you for being with us: 15% off your next order."
                onChange={(e) => patch({ offer: e.target.value })}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Discount %" htmlFor="cmp-discount" hint={`0 to ${MAX_DISCOUNT}%. A bigger discount lifts conversion slightly.`}>
                <div className="flex items-center gap-3">
                  <Slider
                    min={0}
                    max={MAX_DISCOUNT}
                    step={5}
                    value={[draft.discountPct]}
                    onValueChange={([v]) => patch({ discountPct: v ?? 0 })}
                    className="flex-1"
                  />
                  <Input
                    id="cmp-discount"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={MAX_DISCOUNT}
                    step={5}
                    value={draft.discountPct}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      patch({ discountPct: Number.isFinite(n) ? Math.min(MAX_DISCOUNT, Math.max(0, Math.round(n))) : 0 });
                    }}
                    className="w-20"
                  />
                </div>
              </Field>

              <Field label="Points multiplier" htmlFor="cmp-mult" hint="Buyers earn this many times the usual points.">
                <Select
                  value={String(draft.pointsMultiplier)}
                  onValueChange={(v) => patch({ pointsMultiplier: Number(v) })}
                >
                  <SelectTrigger id="cmp-mult">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {POINT_MULTIPLIERS.map((m) => (
                      <SelectItem key={m} value={String(m)}>
                        {m}x points{m === 1 ? " (normal)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div
              role="group"
              aria-live="polite"
              aria-label="Live audience size"
              className="rounded-[16px] border border-border bg-surface p-4"
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Matching" value={formatNumber(summary.matching)} sub="before consent check" />
                <Stat
                  label="Will be contacted"
                  value={formatNumber(summary.consented.length)}
                  tone={reachOk ? "ok" : "warn"}
                  sub="consented"
                />
                <Stat
                  label="Excluded: no consent"
                  value={formatNumber(summary.excluded)}
                  tone={summary.excluded > 0 ? "warn" : undefined}
                  sub="never contacted"
                />
                <Stat label="Est. revenue" value={formatCurrency(summary.estRevenue)} sub="after discount" />
              </div>
              <Progress
                value={consentShare}
                className="mt-4 h-1.5 bg-surface-3"
                aria-label="Share of matching customers with consent"
              />
              <p className="mt-2 flex items-start gap-1.5 text-[11.5px] text-text-2">
                <ShieldCheck className="mt-px size-3.5 shrink-0 text-success" aria-hidden />
                <span>
                  {summary.matching === 0 ? (
                    "DPDP Act 2023: only customers who gave marketing consent will be contacted."
                  ) : (
                    <>
                      DPDP Act 2023: {formatPercent(consentShare, 0)} of matching customers consented.{" "}
                      {summary.excluded === 0
                        ? "Nobody needs to be excluded."
                        : `${formatNumber(summary.excluded)} ${summary.excluded === 1 ? "is" : "are"} excluded automatically.`}
                    </>
                  )}
                </span>
              </p>
              {audienceError && (
                <p role="alert" className={cn("mt-2 flex items-start gap-1.5 text-[12px]", showErrors ? "text-danger" : "text-warning")}>
                  <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                  {audienceError}
                </p>
              )}
            </div>

            <fieldset className="space-y-2">
              <legend className="flex items-center gap-2 text-sm font-medium">
                Segments <span className="text-[11.5px] font-normal text-text-3">required</span>
                <button
                  type="button"
                  className="ml-auto text-[11.5px] font-medium text-primary hover:underline"
                  onClick={() => patch({ segments: draft.segments.length === SEGMENTS.length ? [] : [...SEGMENTS] })}
                >
                  {draft.segments.length === SEGMENTS.length ? "Clear all" : "Select all"}
                </button>
              </legend>
              <div className="flex flex-wrap gap-2">
                {SEGMENTS.map((s) => (
                  <Chip
                    key={s}
                    active={draft.segments.includes(s)}
                    count={counts.seg[s] ?? 0}
                    onClick={() => patch({ segments: toggleIn(draft.segments, s) })}
                  >
                    {segLabel(s)}
                  </Chip>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                Regions <span className="text-[11.5px] font-normal text-text-3">none selected = all</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {REGIONS.map((r) => (
                  <Chip
                    key={r}
                    active={draft.regions.includes(r)}
                    count={counts.reg[r] ?? 0}
                    onClick={() => patch({ regions: toggleIn(draft.regions, r) })}
                  >
                    {r}
                  </Chip>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                Age groups <span className="text-[11.5px] font-normal text-text-3">none selected = all</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {AGE_GROUPS.map((a) => (
                  <Chip
                    key={a}
                    active={draft.ageGroups.includes(a)}
                    count={counts.age[a] ?? 0}
                    onClick={() => patch({ ageGroups: toggleIn(draft.ageGroups, a) })}
                  >
                    {a}
                  </Chip>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">
                Churn risk <span className="text-[11.5px] font-normal text-text-3">none selected = all</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {RISK_BANDS.map((b) => (
                  <Chip
                    key={b}
                    active={draft.riskBands.includes(b)}
                    count={counts.risk[b] ?? 0}
                    onClick={() => patch({ riskBands: toggleIn(draft.riskBands, b) })}
                  >
                    {b} risk
                  </Chip>
                ))}
              </div>
            </fieldset>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <dl className="divide-y divide-border rounded-[16px] border border-border bg-surface text-[13px]">
              {(
                [
                  ["Name", draft.name.trim() || "-", 1],
                  ["Channel", draft.channel, 1],
                  ["Offer", draft.offer.trim() || "-", 1],
                  ["Discount", `${draft.discountPct}%`, 1],
                  ["Points multiplier", `${draft.pointsMultiplier}x`, 1],
                  ["Segments", draft.segments.map(segLabel).join(", ") || "-", 2],
                  [
                    "Filters",
                    [
                      draft.regions.length ? draft.regions.join(", ") : "All regions",
                      draft.ageGroups.length ? draft.ageGroups.join(", ") : "all ages",
                      draft.riskBands.length ? `${draft.riskBands.join("/")} risk` : "any risk",
                    ].join(" · "),
                    2,
                  ],
                ] as Array<[string, string, Step]>
              ).map(([k, v, target]) => (
                <div key={k} className="flex items-start gap-3 px-4 py-2.5">
                  <dt className="w-32 shrink-0 text-text-3">{k}</dt>
                  <dd className="min-w-0 flex-1 break-words font-medium">
                    {k === "Channel" ? (
                      <span className="inline-flex items-center gap-1.5">
                        <ChannelIcon className="size-3.5" aria-hidden />
                        {v}
                      </span>
                    ) : (
                      v
                    )}
                  </dd>
                  <button
                    type="button"
                    className="text-[12px] font-medium text-primary hover:underline"
                    onClick={() => setStep(target)}
                    aria-label={`Edit ${k}`}
                  >
                    Edit
                  </button>
                </div>
              ))}
            </dl>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Matching" value={formatNumber(summary.matching)} />
              <Stat label="Will be contacted" value={formatNumber(summary.consented.length)} tone="ok" sub="consented only" />
              <Stat
                label="Excluded: no consent"
                value={formatNumber(summary.excluded)}
                tone={summary.excluded > 0 ? "warn" : undefined}
              />
              <Stat
                label="Est. revenue"
                value={formatCurrency(summary.estRevenue)}
                sub={`about ${formatNumber(Math.round(summary.estConverted))} buyers`}
              />
            </div>

            {audienceError && (
              <p role="alert" className="flex items-start gap-1.5 text-[12.5px] text-danger">
                <TriangleAlert className="mt-px size-4 shrink-0" aria-hidden />
                {audienceError}
              </p>
            )}

            <div className="rounded-[16px] border border-border bg-surface-2 p-4">
              <Field
                label="Schedule for a later date (optional)"
                htmlFor="cmp-date"
                hint="Scheduled campaigns can be launched from the list at any time."
                error={showErrors && !dateOk ? "Pick today or a later date to schedule." : undefined}
              >
                <Input
                  id="cmp-date"
                  type="date"
                  min={today}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  aria-invalid={showErrors && !dateOk}
                  className="max-w-48"
                />
              </Field>
            </div>
          </div>
        )}

        <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex flex-wrap items-center justify-between gap-2 border-t border-border bg-background px-5 py-4 sm:-mx-6 sm:-mb-6 sm:px-6">
          {step > 1 ? (
            <Button type="button" variant="ghost" onClick={() => setStep((s) => (s - 1) as Step)}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}

          {step < 3 ? (
            <Button type="button" onClick={goNext}>
              {step === 1 ? "Next: audience" : "Next: review"}
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => submit("draft")}>
                <Save className="size-4" />
                Save draft
              </Button>
              <Button type="button" variant="secondary" onClick={() => submit("schedule")}>
                <CalendarClock className="size-4" />
                Schedule
              </Button>
              <Button type="button" onClick={() => submit("launch")}>
                <Rocket className="size-4" />
                Launch now
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

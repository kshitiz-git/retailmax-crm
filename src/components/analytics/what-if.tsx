import * as React from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowDownRight, ArrowUpRight, Megaphone, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { formatCurrency, formatNumber } from "@/lib/format";
import { churnContributions, churnModel, churnProbability, riskBand } from "@/lib/ml/churn";
import {
  AGE_GROUPS,
  REGIONS,
  type AgeGroup,
  type Customer,
  type CustomerRow,
  type Region,
} from "@/lib/data/types";
import { RiskGauge } from "./risk-gauge";
import { featureLabel, median } from "./meta";

interface Profile {
  age_group: AgeGroup;
  region: Region;
  purchase_freq: number;
  avg_order_value: number;
  last_purchase_days: number;
  loyalty_points: number;
}

const toRow = (p: Profile): CustomerRow => ({
  customer_id: "WHAT-IF",
  ...p,
  churn_flag: 0,
  rfm_segment: "New",
});

const fromCustomer = (c: Customer): Profile => ({
  age_group: c.age_group,
  region: c.region,
  purchase_freq: c.purchase_freq,
  avg_order_value: c.avg_order_value,
  last_purchase_days: c.last_purchase_days,
  loyalty_points: c.loyalty_points,
});

function mode<T extends string>(xs: T[], fallback: T): T {
  const n = new Map<T, number>();
  let best = fallback;
  let bestN = 0;
  for (const x of xs) {
    const v = (n.get(x) ?? 0) + 1;
    n.set(x, v);
    if (v > bestN) {
      best = x;
      bestN = v;
    }
  }
  return best;
}

function medianProfile(customers: Customer[]): Profile {
  return {
    age_group: mode(customers.map((c) => c.age_group), AGE_GROUPS[1]),
    region: mode(customers.map((c) => c.region), REGIONS[0]),
    purchase_freq: Math.round(median(customers.map((c) => c.purchase_freq))),
    avg_order_value: Math.round(median(customers.map((c) => c.avg_order_value))),
    last_purchase_days: Math.round(median(customers.map((c) => c.last_purchase_days))),
    loyalty_points: Math.round(median(customers.map((c) => c.loyalty_points))),
  };
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

function SimSlider({
  id,
  label,
  hint,
  value,
  onChange,
  max,
  step,
  format,
}: {
  id: string;
  label: string;
  hint: string;
  value: number;
  onChange: (v: number) => void;
  max: number;
  step: number;
  format: (v: number) => string;
}) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <label htmlFor={id} className="text-[12.5px] font-medium">
            {label}
          </label>
          <p className="text-[11px] text-muted-foreground">
            {hint} · now {format(value)}
          </p>
        </div>
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          min={0}
          step={step}
          value={value}
          onChange={(e) => {
            const n = Number(e.target.value);
            onChange(Number.isFinite(n) && n >= 0 ? n : 0);
          }}
          className="h-8 w-24 shrink-0 text-right text-[13px] tabular-nums"
        />
      </div>
      <Slider
        className="mt-2.5"
        aria-label={label}
        min={0}
        max={max}
        step={step}
        value={[Math.min(max, value)]}
        onValueChange={([v]) => onChange(v ?? 0)}
      />
    </div>
  );
}

function CategoryPick<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[12.5px] font-medium">{label}</p>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger aria-label={label} className="h-9">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const ADVICE = {
  High: "High risk. Send a win-back offer now (only to customers who gave marketing consent).",
  Medium: "Medium risk. A reminder or a bonus-points nudge keeps this customer warm.",
  Low: "Low risk. Keep rewarding with points and early access.",
} as const;

/** Live ML demo: change a customer's inputs and watch the churn probability and its drivers move. */
export function WhatIfSimulator({ customers, byId }: { customers: Customer[]; byId: Map<string, Customer> }) {
  const median0 = React.useMemo(() => medianProfile(customers), [customers]);
  const [profile, setProfile] = React.useState<Profile>(median0);
  const [start, setStart] = React.useState<{ label: string; profile: Profile }>({ label: "Median customer", profile: median0 });
  const [idInput, setIdInput] = React.useState("");

  const ranges = React.useMemo(() => {
    let f = 0;
    let a = 0;
    let d = 0;
    let p = 0;
    for (const c of customers) {
      f = Math.max(f, c.purchase_freq);
      a = Math.max(a, c.avg_order_value);
      d = Math.max(d, c.last_purchase_days);
      p = Math.max(p, c.loyalty_points);
    }
    return {
      purchase_freq: Math.max(10, Math.ceil(f)),
      avg_order_value: Math.max(1000, Math.ceil(a / 1000) * 1000),
      last_purchase_days: Math.max(30, Math.ceil(d)),
      loyalty_points: Math.max(500, Math.ceil(p / 100) * 100),
    };
  }, [customers]);

  const extremes = React.useMemo(() => {
    let hi: Customer | undefined;
    let lo: Customer | undefined;
    for (const c of customers) {
      if (!hi || c.churnProb > hi.churnProb) hi = c;
      if (!lo || c.churnProb < lo.churnProb) lo = c;
    }
    return { hi, lo };
  }, [customers]);

  const row = React.useMemo(() => toRow(profile), [profile]);
  const prob = React.useMemo(() => churnProbability(row), [row]);
  const contribs = React.useMemo(
    () => churnContributions(row).sort((x, y) => Math.abs(y.value) - Math.abs(x.value)),
    [row],
  );
  const startProb = React.useMemo(() => churnProbability(toRow(start.profile)), [start]);
  const baseRate = sigmoid(churnModel.intercept);
  const band = riskBand(prob);
  const maxAbs = Math.max(0.05, ...contribs.map((c) => Math.abs(c.value)));
  const deltaPts = (prob - startProb) * 100;

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setProfile((p) => ({ ...p, [k]: v }));
  const begin = (label: string, p: Profile) => {
    setProfile(p);
    setStart({ label, profile: p });
  };
  const loadCustomer = (c: Customer | undefined, label?: string) => {
    if (c) begin(label ?? c.customer_id, fromCustomer(c));
  };
  const submitId = (e: React.FormEvent) => {
    e.preventDefault();
    const id = idInput.trim().toUpperCase();
    if (!id) return;
    const c = byId.get(id);
    if (!c) {
      toast.error(`Customer ${id} was not found`);
      return;
    }
    loadCustomer(c);
    toast.success(`Loaded ${id}`);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      {/* Inputs */}
      <div className="min-w-0 space-y-5">
        <div>
          <p className="text-[12.5px] font-medium">Start from</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => begin("Median customer", median0)}>
              Median customer
            </Button>
            <Button size="sm" variant="outline" disabled={!extremes.hi} onClick={() => loadCustomer(extremes.hi, `${extremes.hi?.customer_id} (highest risk)`)}>
              Highest risk
            </Button>
            <Button size="sm" variant="outline" disabled={!extremes.lo} onClick={() => loadCustomer(extremes.lo, `${extremes.lo?.customer_id} (lowest risk)`)}>
              Lowest risk
            </Button>
          </div>
          <form onSubmit={submitId} className="mt-2 flex gap-2">
            <Input
              aria-label="Customer ID"
              placeholder="Or type a customer ID, e.g. C00042"
              value={idInput}
              onChange={(e) => setIdInput(e.target.value)}
              className="h-9 max-w-xs"
            />
            <Button type="submit" size="sm" className="h-9">
              Load
            </Button>
          </form>
        </div>

        <div className="space-y-5">
          <SimSlider
            id="wi-recency"
            label="Days since last purchase"
            hint="Longer gap, higher risk"
            value={profile.last_purchase_days}
            onChange={(v) => set("last_purchase_days", v)}
            max={ranges.last_purchase_days}
            step={1}
            format={(v) => `${formatNumber(v)} days`}
          />
          <SimSlider
            id="wi-freq"
            label="Purchase frequency"
            hint="Number of purchases"
            value={profile.purchase_freq}
            onChange={(v) => set("purchase_freq", v)}
            max={ranges.purchase_freq}
            step={1}
            format={(v) => `${formatNumber(v)} orders`}
          />
          <SimSlider
            id="wi-aov"
            label="Average order value"
            hint="INR per order"
            value={profile.avg_order_value}
            onChange={(v) => set("avg_order_value", v)}
            max={ranges.avg_order_value}
            step={100}
            format={formatCurrency}
          />
          <SimSlider
            id="wi-points"
            label="Loyalty points"
            hint="Balance in the dataset"
            value={profile.loyalty_points}
            onChange={(v) => set("loyalty_points", v)}
            max={ranges.loyalty_points}
            step={50}
            format={(v) => `${formatNumber(v)} pts`}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <CategoryPick label="Age group" value={profile.age_group} options={AGE_GROUPS} onChange={(v) => set("age_group", v)} />
          <CategoryPick label="Region" value={profile.region} options={REGIONS} onChange={(v) => set("region", v)} />
        </div>

        <Button size="sm" variant="ghost" onClick={() => setProfile(start.profile)}>
          <RotateCcw /> Reset to {start.label}
        </Button>
      </div>

      {/* Output */}
      <div className="min-w-0 rounded-[16px] border border-border bg-surface-2/50 p-4 sm:p-5">
        <p className="text-micro text-muted-foreground">Predicted churn probability</p>
        <div className="mt-3">
          <RiskGauge value={prob} threshold={churnModel.threshold || 0.5} />
        </div>

        <p
          className={cn(
            "mt-2 flex items-center justify-center gap-1 text-[12px] font-medium tabular-nums",
            Math.abs(deltaPts) < 0.05 ? "text-muted-foreground" : deltaPts > 0 ? "text-danger" : "text-success",
          )}
          aria-live="polite"
        >
          {Math.abs(deltaPts) < 0.05 ? null : deltaPts > 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
          {Math.abs(deltaPts) < 0.05
            ? `Same as ${start.label}`
            : `${deltaPts > 0 ? "+" : ""}${deltaPts.toFixed(1)} points vs ${start.label} (${(startProb * 100).toFixed(1)}%)`}
        </p>
        <p className="mt-2 text-center text-[12px] leading-relaxed text-text-2">{ADVICE[band]}</p>
        {band !== "Low" && (
          <div className="mt-2 flex justify-center">
            <Button asChild size="sm" variant="outline">
              <Link to={`/campaigns?risk=${band}`}>
                <Megaphone /> Create campaign for {band} risk
              </Link>
            </Button>
          </div>
        )}

        <div className="mt-5 border-t border-dashed border-border pt-4">
          <p className="text-[12.5px] font-medium">What is driving the score</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Right = pushes churn risk up, left = pushes it down. Starting point (average customer): {(baseRate * 100).toFixed(1)}%.
          </p>
          <ul className="mt-3 space-y-2">
            {contribs.map((c) => {
              const w = (Math.abs(c.value) / maxAbs) * 50;
              const up = c.value > 0;
              return (
                <li
                  key={c.feature}
                  className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_2.75rem] items-center gap-2 text-[11.5px] sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_3rem]"
                  title={`${featureLabel(c.feature)} moves the log-odds by ${c.value.toFixed(2)}`}
                >
                  <span className="truncate">{featureLabel(c.feature)}</span>
                  <div className="relative h-3 rounded-full bg-surface-3">
                    <span aria-hidden className="absolute inset-y-[-2px] left-1/2 w-px bg-border" />
                    <span
                      aria-hidden
                      className="absolute inset-y-0 rounded-full transition-all duration-300"
                      style={{
                        width: `${w}%`,
                        left: up ? "50%" : `${50 - w}%`,
                        backgroundColor: up ? "var(--chart-7)" : "var(--chart-3)",
                      }}
                    />
                  </div>
                  <span className={cn("text-right tabular-nums", up ? "text-danger" : "text-success")}>
                    {up ? "+" : ""}
                    {c.value.toFixed(2)}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[10.5px] leading-relaxed text-muted-foreground">
            Values are log-odds: model weight × how far this input is from the average customer. They add up to the final
            score. Everything runs in your browser.
          </p>
        </div>
      </div>
    </div>
  );
}

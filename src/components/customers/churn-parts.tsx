import { motion } from "motion/react";

import { riskColorVar } from "@/components/customers/badges";
import { usePrefersReducedMotion } from "@/hooks/use-motion-prefs";
import type { Customer, CustomerRow, RiskBand } from "@/lib/data/types";
import { formatCurrency, formatNumber } from "@/lib/format";
import { D, E } from "@/lib/motion";
import { churnContributions, churnModel } from "@/lib/ml/churn";

/* ------------------------------ Plain labels ------------------------------ */

const NUMERIC: Record<string, { label: string; detail: (r: CustomerRow) => string }> = {
  purchase_freq: { label: "Number of orders", detail: (r) => `${formatNumber(r.purchase_freq)} orders` },
  avg_order_value: { label: "Average order value", detail: (r) => formatCurrency(r.avg_order_value) },
  last_purchase_days: { label: "Days since last purchase", detail: (r) => `${formatNumber(r.last_purchase_days)} days` },
  loyalty_points: { label: "Loyalty points", detail: (r) => `${formatNumber(r.loyalty_points)} points` },
};

/** "age_group=26-35" -> { label: "Age group", detail: "26-35" }. */
export function describeFeature(feature: string, row: CustomerRow): { label: string; detail: string } {
  const num = NUMERIC[feature];
  if (num) return { label: num.label, detail: num.detail(row) };
  const [col = feature, value = ""] = feature.split("=");
  const label = col.replace(/_/g, " ");
  return { label: label.charAt(0).toUpperCase() + label.slice(1), detail: value };
}

/* ------------------------------ Explainer ------------------------------ */

/** Top 5 features by absolute log-odds contribution, as a diverging bar list. */
export function ChurnExplainer({ customer }: { customer: Customer }) {
  const reduced = usePrefersReducedMotion();
  const all = churnContributions(customer);
  const top = [...all].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 5);
  const max = Math.max(...top.map((t) => Math.abs(t.value)), 0.01);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-text-2">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-danger" /> Raises churn risk
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full bg-success" /> Lowers churn risk
        </span>
      </div>
      <ul className="space-y-3.5">
        {top.map((t) => {
          const { label, detail } = describeFeature(t.feature, customer);
          const raises = t.value >= 0;
          const half = (Math.abs(t.value) / max) * 50;
          return (
            <li key={t.feature}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 truncate text-[13px] font-medium">
                  {label} <span className="font-normal text-text-3">· {detail}</span>
                </p>
                <p
                  className={`shrink-0 text-[12px] font-semibold tnum ${raises ? "text-danger" : "text-success"}`}
                  title="Contribution to the churn score (log-odds)"
                >
                  {raises ? "+" : "−"}
                  {Math.abs(t.value).toFixed(2)}
                </p>
              </div>
              <div
                role="img"
                aria-label={`${label}: ${raises ? "raises" : "lowers"} churn risk by ${Math.abs(t.value).toFixed(2)}`}
                className="relative mt-1.5 h-2 rounded-full bg-surface-2"
              >
                <span aria-hidden className="absolute inset-y-[-3px] left-1/2 w-px bg-border-solid" />
                <motion.span
                  aria-hidden
                  className="absolute inset-y-0 rounded-full"
                  style={{
                    left: raises ? "50%" : `${50 - half}%`,
                    width: `${half}%`,
                    background: raises ? "var(--danger)" : "var(--success)",
                    transformOrigin: raises ? "left" : "right",
                  }}
                  initial={reduced ? false : { scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: D.slow, ease: E.out }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-[11.5px] leading-relaxed text-text-3">
        Top 5 of {all.length} factors in the model. Longer bar = bigger push on the score.
        {churnModel.trained_at === "placeholder" && " The model is not trained yet, so these numbers are placeholders."}
      </p>
    </div>
  );
}

/* ------------------------------ Gauge ------------------------------ */

const ARC = "M16 70 A54 54 0 0 1 124 70";
const ARC_LEN = Math.PI * 54;

/** Half-circle gauge coloured by risk band, with a tick at the model's decision threshold. */
export function ChurnGauge({ prob, band }: { prob: number; band: RiskBand }) {
  const reduced = usePrefersReducedMotion();
  const t = churnModel.threshold || 0.5;
  const a = Math.PI * (1 - t);
  const tick = {
    x1: 70 + 47 * Math.cos(a),
    y1: 70 - 47 * Math.sin(a),
    x2: 70 + 63 * Math.cos(a),
    y2: 70 - 63 * Math.sin(a),
  };
  const pct = prob * 100;
  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox="0 0 140 84"
        className="w-full max-w-[240px]"
        role="img"
        aria-label={`Churn probability ${pct.toFixed(1)} percent, ${band} risk`}
      >
        <path d={ARC} fill="none" stroke="var(--surface-3)" strokeWidth="12" strokeLinecap="round" />
        <motion.path
          d={ARC}
          fill="none"
          stroke={riskColorVar(band)}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={ARC_LEN}
          initial={reduced ? false : { strokeDashoffset: ARC_LEN }}
          animate={{ strokeDashoffset: ARC_LEN * (1 - Math.min(1, prob)) }}
          transition={{ duration: D.chart, ease: E.out }}
        />
        <line {...tick} stroke="var(--foreground)" strokeWidth="1.5" strokeLinecap="round" opacity="0.55" />
        <text x="70" y="62" textAnchor="middle" className="fill-foreground text-[22px] font-semibold">
          {pct.toFixed(1)}%
        </text>
        <text x="70" y="77" textAnchor="middle" className="fill-text-3 text-[8px]">
          chance of churn
        </text>
      </svg>
      <p className="mt-1 text-[11px] text-text-3">
        Tick marks the {Math.round(t * 100)}% line where the model flags High risk.
      </p>
    </div>
  );
}

import { Brain, CalendarDays, Database, FlaskConical, Gauge, Info, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber, formatPercent } from "@/lib/format";
import { churnModel } from "@/lib/ml/churn";
import { StatTile } from "./bits";
import { featureLabel, isPlaceholderModel, normName, prettyModelName } from "./meta";

const m = churnModel.metrics;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-01 03:49:30" -> "1 Nov 2026, 03:49". Shown as written: the training script stores no timezone. */
function formatTrainedAt(raw: string) {
  const t = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(raw);
  if (!t) return raw;
  return `${Number(t[3])} ${MONTHS[Number(t[2]) - 1] ?? ""} ${t[1]}, ${t[4]}:${t[5]}`;
}

/** Friendly note shown while src/data/churn-model.json is still the placeholder. */
export function ModelNotTrained() {
  return (
    <div role="status" className="flex items-start gap-3 rounded-[14px] border border-dashed border-border bg-surface-2 px-4 py-3.5">
      <Info className="mt-0.5 size-4 shrink-0 text-primary" />
      <div>
        <p className="text-[13px] font-semibold">Model not trained yet</p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
          Churn scores below come from a starter model. Once the training run finishes, this card shows the real accuracy,
          confusion matrix and feature importance.
        </p>
      </div>
    </div>
  );
}

function Fact({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-[12px] bg-surface-2 px-3 py-2">
      <Icon className="size-4 shrink-0 text-primary" strokeWidth={1.7} />
      <div className="min-w-0">
        <p className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate text-[12.5px] font-medium">{value}</p>
      </div>
    </div>
  );
}

export function ModelFacts() {
  const trained = !isPlaceholderModel();
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
      <Fact icon={Brain} label="Algorithm" value={prettyModelName(churnModel.model)} />
      <Fact icon={Database} label="Trained on" value={trained ? `${formatNumber(churnModel.trained_on_rows)} customers` : "Not trained yet"} />
      <Fact icon={CalendarDays} label="Trained at" value={trained ? formatTrainedAt(churnModel.trained_at) : "n/a"} />
      <Fact icon={FlaskConical} label="Held-out test" value={trained ? `${formatNumber(m.test_rows)} customers` : "n/a"} />
    </div>
  );
}

export function MetricTiles() {
  const trained = !isPlaceholderModel();
  const pct = (v: number) => (trained ? formatPercent(v * 100) : "n/a");
  const tiles = [
    { label: "Accuracy", value: pct(m.accuracy), sub: "Right calls out of all calls" },
    { label: "Precision", value: pct(m.precision), sub: "Flagged who really churn" },
    { label: "Recall", value: pct(m.recall), sub: "Churners we caught" },
    { label: "F1 score", value: pct(m.f1), sub: "Balance of precision and recall" },
    { label: "ROC-AUC", value: trained ? m.roc_auc.toFixed(3) : "n/a", sub: "1.0 perfect, 0.5 coin flip" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((t) => (
        <StatTile key={t.label} label={t.label} value={t.value} sub={t.sub} />
      ))}
    </div>
  );
}

/** 2 x 2 confusion matrix. sklearn layout: rows = actual [stayed, churned], columns = predicted. */
export function ConfusionMatrix() {
  const cm = m.confusion_matrix;
  const tn = cm[0]?.[0] ?? 0;
  const fp = cm[0]?.[1] ?? 0;
  const fn = cm[1]?.[0] ?? 0;
  const tp = cm[1]?.[1] ?? 0;
  const total = tn + fp + fn + tp;
  const max = Math.max(tn, fp, fn, tp, 1);
  const cells = [
    { v: tn, name: "True negative", note: "Stayed, predicted to stay", good: true },
    { v: fp, name: "False alarm", note: "Stayed, predicted to churn", good: false },
    { v: fn, name: "Missed churner", note: "Churned, predicted to stay", good: false },
    { v: tp, name: "True positive", note: "Churned, caught", good: true },
  ];
  return (
    <div>
      <div className="grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1fr)] gap-1.5">
        <span />
        <p className="text-center text-[10.5px] font-medium text-muted-foreground">Predicted: stays</p>
        <p className="text-center text-[10.5px] font-medium text-muted-foreground">Predicted: churns</p>

        <p className="flex items-center justify-center text-[10.5px] font-medium text-muted-foreground [writing-mode:vertical-rl] rotate-180">
          Actual: stayed
        </p>
        {cells.slice(0, 2).map((c) => (
          <MatrixCell key={c.name} {...c} total={total} max={max} />
        ))}
        <p className="flex items-center justify-center text-[10.5px] font-medium text-muted-foreground [writing-mode:vertical-rl] rotate-180">
          Actual: churned
        </p>
        {cells.slice(2).map((c) => (
          <MatrixCell key={c.name} {...c} total={total} max={max} />
        ))}
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
        {tn + fp + fn + tp > 0 ? (
          <>
            Of {formatNumber(fn + tp)} customers who really churned, the model caught {formatNumber(tp)}. It raised{" "}
            {formatNumber(fp)} false alarms among {formatNumber(tn + fp)} who stayed.
          </>
        ) : (
          <>Counts appear once the model is trained.</>
        )}
      </p>
    </div>
  );
}

function MatrixCell({
  v,
  name,
  note,
  good,
  total,
  max,
}: {
  v: number;
  name: string;
  note: string;
  good: boolean;
  total: number;
  max: number;
}) {
  const color = good ? "var(--chart-3)" : "var(--chart-7)";
  return (
    <div
      className="flex min-h-[88px] flex-col items-center justify-center rounded-xl px-2 py-2.5 text-center"
      style={{ backgroundColor: `color-mix(in oklab, ${color} ${Math.round(10 + 40 * (v / max))}%, var(--surface))` }}
      title={`${name}: ${formatNumber(v)} customers. ${note}.`}
    >
      <p className="metric text-[24px]">{formatNumber(v)}</p>
      <p className="mt-1 text-[11px] font-medium">{name}</p>
      <p className="text-[10px] text-muted-foreground tabular-nums">
        {total ? formatPercent((v / total) * 100) : "0.0%"} of test
      </p>
    </div>
  );
}

const COLS = [
  { key: "accuracy", label: "Accuracy" },
  { key: "precision", label: "Precision" },
  { key: "recall", label: "Recall" },
  { key: "f1", label: "F1" },
  { key: "roc_auc", label: "ROC-AUC" },
] as const;

export function ComparisonTable() {
  const rows = churnModel.comparison;
  if (!rows.length) {
    return <p className="text-[12.5px] text-muted-foreground">The model comparison appears after training.</p>;
  }
  const inUse = normName(churnModel.model);
  return (
    <div className="overflow-hidden rounded-[14px] border border-border">
      <Table className="text-[12.5px]">
        <TableHeader>
          <TableRow className="bg-surface-2/60 hover:bg-surface-2/60">
            <TableHead className="h-auto px-2.5 py-2">Metric</TableHead>
            {rows.map((r) => (
              <TableHead key={r.model} className="h-auto px-2.5 py-2 text-right leading-tight">
                {prettyModelName(r.model)}
                {normName(r.model) === inUse && (
                  <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 align-middle text-[9.5px]">
                    In use
                  </Badge>
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {COLS.map((c) => {
            const best = Math.max(...rows.map((r) => r[c.key]));
            return (
              <TableRow key={c.key}>
                <TableCell className="px-2.5 py-2 font-medium">{c.label}</TableCell>
                {rows.map((r) => {
                  const v = r[c.key];
                  return (
                    <TableCell
                      key={r.model}
                      className={cn("px-2.5 py-2 text-right tabular-nums", v === best && rows.length > 1 && "font-semibold text-success")}
                    >
                      {c.key === "roc_auc" ? v.toFixed(3) : formatPercent(v * 100)}
                    </TableCell>
                  );
                })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="border-t border-border px-3 py-2 text-[10.5px] leading-relaxed text-muted-foreground">
        Green = best in that row. Same held-out test customers for every model. {prettyModelName(churnModel.model)} is the
        model in use because its weights let the CRM explain every score.
      </p>
    </div>
  );
}

export function FeatureImportance() {
  const items = [...churnModel.feature_importance].sort((a, b) => b.importance - a.importance).slice(0, 10);
  if (!items.length) {
    return <p className="text-[12.5px] text-muted-foreground">Feature importance appears after training.</p>;
  }
  const max = Math.max(...items.map((i) => i.importance), 1e-9);
  const sum = churnModel.feature_importance.reduce((t, i) => t + i.importance, 0);
  const asShare = Math.abs(sum - 1) < 0.03;
  return (
    <ul className="space-y-2.5">
      {items.map((it) => (
        <li key={it.feature}>
          <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
            <span className="truncate font-medium">{featureLabel(it.feature)}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">{asShare ? formatPercent(it.importance * 100) : it.importance.toFixed(max < 1 ? 3 : 2)}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-3">
            <div
              className="h-full rounded-full"
              style={{ width: `${(it.importance / max) * 100}%`, backgroundColor: "var(--chart-1)" }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function SignalNote() {
  const orig = churnModel.original_500_roc_auc;
  return (
    <div className="flex items-start gap-3 rounded-[14px] bg-surface-2 px-4 py-3.5">
      <Gauge className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.7} />
      <div className="text-[12.5px] leading-relaxed text-text-2">
        <p>
          <span className="font-medium text-foreground">Honest note on the data.</span> Trained on the original 500 rows
          alone, the model reaches ROC-AUC {orig.toFixed(2)}. The original 500 rows carry no churn signal (AUC ≈ 0.5):
          a coin flip does as well.
          {!isPlaceholderModel() && m.roc_auc > orig + 0.05 && (
            <>
              {" "}
              The model above scores {m.roc_auc.toFixed(2)} because the extra rows (C00501 and above) are synthetic and
              built so that churn depends on recency, frequency and spend.
            </>
          )}
        </p>
      </div>
    </div>
  );
}

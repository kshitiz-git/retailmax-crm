import model from "@/data/churn-model.json";
import type { CustomerRow, RiskBand } from "@/lib/data/types";

/**
 * Logistic regression trained offline in Python (analysis/train_churn_model.py)
 * and exported as JSON. Scoring runs in the browser:
 *   p = sigmoid(intercept + Σ coef[numeric] * (x - mean) / std + Σ coef["col=value"])
 */
export interface ChurnModel {
  model: string;
  trained_on_rows: number;
  numeric: Record<string, { mean: number; std: number }>;
  categorical: Record<string, string[]>;
  coef: Record<string, number>;
  intercept: number;
  threshold: number;
  metrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1: number;
    roc_auc: number;
    confusion_matrix: number[][];
    test_rows: number;
  };
  comparison: Array<{ model: string; accuracy: number; precision: number; recall: number; f1: number; roc_auc: number }>;
  original_500_roc_auc: number;
  feature_importance: Array<{ feature: string; importance: number }>;
  trained_at: string;
}

export const churnModel = model as ChurnModel;

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export interface Contribution {
  feature: string;
  /** Additive contribution to the log-odds. Positive = pushes towards churn. */
  value: number;
}

/** Per-feature log-odds contributions for one customer (explainability). */
export function churnContributions(row: CustomerRow): Contribution[] {
  const out: Contribution[] = [];
  for (const [feature, stats] of Object.entries(churnModel.numeric)) {
    const x = Number((row as unknown as Record<string, unknown>)[feature]);
    const z = stats.std ? (x - stats.mean) / stats.std : 0;
    out.push({ feature, value: (churnModel.coef[feature] ?? 0) * z });
  }
  for (const col of Object.keys(churnModel.categorical)) {
    const v = String((row as unknown as Record<string, unknown>)[col]);
    const key = `${col}=${v}`;
    out.push({ feature: key, value: churnModel.coef[key] ?? 0 });
  }
  return out;
}

export function churnProbability(row: CustomerRow): number {
  const z = churnContributions(row).reduce((s, c) => s + c.value, churnModel.intercept);
  return sigmoid(z);
}

/** Bands used across the app. High = at or above the model's decision threshold. */
export function riskBand(p: number): RiskBand {
  const t = churnModel.threshold || 0.5;
  if (p >= t) return "High";
  if (p >= t * 0.6) return "Medium";
  return "Low";
}

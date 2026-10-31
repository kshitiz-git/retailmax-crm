/** Locale-aware formatters. All numbers render with tabular figures. */

export type Period = "today" | "7d" | "30d" | "90d";

export const PERIOD_LABEL: Record<Period, string> = {
  today: "Today",
  "7d": "7d",
  "30d": "30d",
  "90d": "90d",
};

export const PERIOD_DAYS: Record<Period, number> = {
  today: 1,
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrPrecise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const num = new Intl.NumberFormat("en-IN");

export const formatCurrency = (value: number) => inr.format(Math.round(value));
export const formatCurrencyPrecise = (value: number) => inrPrecise.format(value);
export const formatNumber = (value: number) => num.format(Math.round(value));
export const formatPercent = (value: number, digits = 1) => `${value.toFixed(digits)}%`;
export const formatHours = (value: number) => `${num.format(Math.round(value))} h`;

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export function formatCompact(value: number) {
  if (Math.abs(value) >= 10000000) return `${(value / 10000000).toFixed(1)}Cr`;
  if (Math.abs(value) >= 100000) return `${(value / 100000).toFixed(1)}L`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return formatNumber(value);
}

export function formatIST(iso: string, withTime = true) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: true } : {}),
  });
}

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatIST(iso, false);
}

/** Chart series colour by semantic meaning — locked app-wide. */
export const SEMANTIC_COLOR = {
  total: "var(--chart-1)",
  connected: "var(--chart-2)",
  hot: "var(--chart-3)",
  warm: "var(--chart-4)",
  rescheduled: "var(--chart-5)",
  booked: "var(--chart-6)",
  lost: "var(--chart-7)",
  voicemail: "var(--chart-8)",
} as const;

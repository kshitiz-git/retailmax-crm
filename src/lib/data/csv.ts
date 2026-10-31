import { AGE_GROUPS, CSV_COLUMNS, REGIONS, SEGMENTS, type CustomerRow } from "./types";

/** Minimal RFC-4180 parser: handles quoted fields, escaped quotes and CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

export interface RowError {
  line: number;
  message: string;
}

export interface ParseResult {
  rows: CustomerRow[];
  errors: RowError[];
}

const num = (v: string | undefined) => (v === undefined || v.trim() === "" ? NaN : Number(v));

/**
 * Parse and validate dataset.csv text. Header must contain every column of CSV_COLUMNS
 * (any order). Invalid rows are skipped and reported, never silently coerced.
 */
export function parseCustomers(text: string): ParseResult {
  const table = parseCsv(text.replace(/^﻿/, ""));
  const errors: RowError[] = [];
  if (table.length === 0) return { rows: [], errors: [{ line: 1, message: "File is empty" }] };
  const header = table[0]!.map((h) => h.trim());
  const missing = CSV_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) {
    return { rows: [], errors: [{ line: 1, message: `Missing column(s): ${missing.join(", ")}` }] };
  }
  const idx = Object.fromEntries(CSV_COLUMNS.map((c) => [c, header.indexOf(c)])) as Record<
    (typeof CSV_COLUMNS)[number],
    number
  >;
  const rows: CustomerRow[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < table.length; i++) {
    const r = table[i]!;
    const line = i + 1;
    const get = (c: (typeof CSV_COLUMNS)[number]) => (r[idx[c]] ?? "").trim();
    const id = get("customer_id");
    const age = get("age_group");
    const region = get("region");
    const seg = get("rfm_segment");
    const freq = num(get("purchase_freq"));
    const aov = num(get("avg_order_value"));
    const days = num(get("last_purchase_days"));
    const pts = num(get("loyalty_points"));
    const churn = num(get("churn_flag"));
    const problems: string[] = [];
    if (!id) problems.push("customer_id empty");
    else if (seen.has(id)) problems.push(`duplicate customer_id ${id}`);
    if (!(AGE_GROUPS as readonly string[]).includes(age)) problems.push(`age_group "${age}" invalid`);
    if (!(REGIONS as readonly string[]).includes(region)) problems.push(`region "${region}" invalid`);
    if (!(SEGMENTS as readonly string[]).includes(seg)) problems.push(`rfm_segment "${seg}" invalid`);
    if (!Number.isFinite(freq) || freq < 0) problems.push("purchase_freq must be >= 0");
    if (!Number.isFinite(aov) || aov < 0) problems.push("avg_order_value must be >= 0");
    if (!Number.isFinite(days) || days < 0 || days > 3650) problems.push("last_purchase_days out of range");
    if (!Number.isFinite(pts) || pts < 0) problems.push("loyalty_points must be >= 0");
    if (churn !== 0 && churn !== 1) problems.push("churn_flag must be 0 or 1");
    if (problems.length) {
      errors.push({ line, message: problems.join("; ") });
      continue;
    }
    seen.add(id);
    rows.push({
      customer_id: id,
      age_group: age as CustomerRow["age_group"],
      region: region as CustomerRow["region"],
      purchase_freq: freq,
      avg_order_value: aov,
      last_purchase_days: days,
      loyalty_points: pts,
      churn_flag: churn as 0 | 1,
      rfm_segment: seg as CustomerRow["rfm_segment"],
    });
  }
  return { rows, errors };
}

const esc = (v: unknown) => {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Generic CSV writer. */
export function toCsv(header: readonly string[], rows: ReadonlyArray<ReadonlyArray<unknown>>): string {
  return [header.map(esc).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n") + "\n";
}

/** Export rows in the exact dataset.csv column order. */
export function customersToCsv(rows: ReadonlyArray<CustomerRow>): string {
  return toCsv(
    CSV_COLUMNS,
    rows.map((r) => CSV_COLUMNS.map((c) => r[c])),
  );
}

/** Trigger a browser download of a text file. */
export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

import { toCsv } from "@/lib/data/csv";
import type { AuditEvent, ConsentEvent, Customer } from "@/lib/data/types";

export const CONSENT_REGISTER_COLUMNS = ["customer_id", "consent", "last_change"] as const;

/**
 * Consent register for DPDP audits: one row per customer with the current consent and the time of the
 * last recorded change. Erased customers are listed too (consent = erased) so the erasure is on record.
 */
export function consentRegisterCsv(
  customers: readonly Customer[],
  consentLog: readonly ConsentEvent[],
  audit: readonly AuditEvent[],
  erased: readonly string[],
): string {
  const lastChange = new Map<string, string>();
  for (const e of consentLog) {
    const prev = lastChange.get(e.customer_id);
    if (!prev || e.at > prev) lastChange.set(e.customer_id, e.at);
  }
  const erasedAt = new Map<string, string>();
  for (const a of audit) {
    if (a.action !== "privacy.erase") continue;
    const prev = erasedAt.get(a.detail);
    if (!prev || a.at > prev) erasedAt.set(a.detail, a.at);
  }

  const rows: string[][] = customers.map((c) => [
    c.customer_id,
    c.consent ? "granted" : "not_granted",
    lastChange.get(c.customer_id) ?? "no change recorded",
  ]);
  for (const id of erased) rows.push([id, "erased", erasedAt.get(id) ?? "no change recorded"]);
  return toCsv(CONSENT_REGISTER_COLUMNS, rows);
}

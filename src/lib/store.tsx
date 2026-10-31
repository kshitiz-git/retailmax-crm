import * as React from "react";
import datasetText from "@/data/customers.csv?raw";
import { parseCustomers } from "@/lib/data/csv";
import { deriveCustomers } from "@/lib/data/derive";
import type {
  AuditEvent,
  Campaign,
  ConsentEvent,
  Customer,
  CustomerRow,
  LoyaltyTxn,
  Note,
} from "@/lib/data/types";

/**
 * Single client-side store. The bundled dataset.csv is the base; everything a user changes
 * (imports, consent, points, notes, campaigns) is persisted to localStorage so the demo
 * survives a reload. No server, no network.
 */

const STORAGE_KEY = "retailmax-crm:v1";

interface Persisted {
  /** Present only after a CSV import replaced/merged the bundled dataset. */
  rows?: CustomerRow[];
  consent: Record<string, boolean>;
  loyaltyTxns: LoyaltyTxn[];
  consentLog: ConsentEvent[];
  notes: Note[];
  campaigns: Campaign[];
  audit: AuditEvent[];
  /** Customers erased under a DPDP erasure request. */
  erased: string[];
}

const EMPTY: Persisted = {
  consent: {},
  loyaltyTxns: [],
  consentLog: [],
  notes: [],
  campaigns: [],
  audit: [],
  erased: [],
};

const base = parseCustomers(datasetText);
export const BUNDLED_ROWS: CustomerRow[] = base.rows;
export const BUNDLED_ERRORS = base.errors;

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<Persisted>) };
  } catch {
    return EMPTY;
  }
}

export const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const now = () => new Date().toISOString();

export interface CRM {
  customers: Customer[];
  byId: Map<string, Customer>;
  /** Raw rows currently in use (bundled or imported), minus erased ones. */
  rows: CustomerRow[];
  dataSource: "bundled" | "imported";
  campaigns: Campaign[];
  loyaltyTxns: LoyaltyTxn[];
  consentLog: ConsentEvent[];
  notes: Note[];
  audit: AuditEvent[];
  erased: string[];

  addCampaign(c: Omit<Campaign, "id" | "createdAt">): Campaign;
  updateCampaign(id: string, patch: Partial<Campaign>): void;
  deleteCampaign(id: string): void;
  adjustPoints(customerId: string, points: number, reason: string): void;
  /** Same reason applied to many customers in one write (bulk award). */
  adjustPointsBulk(entries: Array<{ customerId: string; points: number }>, reason: string): void;
  setConsent(customerId: string, granted: boolean, source: string): void;
  addNote(customerId: string, text: string): void;
  importRows(rows: CustomerRow[], mode: "merge" | "replace"): void;
  eraseCustomer(customerId: string): void;
  log(action: string, detail: string): void;
  resetDemo(): void;
}

const Ctx = React.createContext<CRM | null>(null);

export function CRMProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<Persisted>(load);

  React.useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* storage full or blocked: the demo still works for this session */
    }
  }, [state]);

  const rows = React.useMemo(() => {
    const src = state.rows ?? BUNDLED_ROWS;
    if (!state.erased.length) return src;
    const gone = new Set(state.erased);
    return src.filter((r) => !gone.has(r.customer_id));
  }, [state.rows, state.erased]);

  const pointsDelta = React.useMemo(() => {
    const d: Record<string, number> = {};
    for (const t of state.loyaltyTxns) d[t.customer_id] = (d[t.customer_id] ?? 0) + t.points;
    return d;
  }, [state.loyaltyTxns]);

  const customers = React.useMemo(
    () => deriveCustomers(rows, pointsDelta, state.consent),
    [rows, pointsDelta, state.consent],
  );
  const byId = React.useMemo(() => new Map(customers.map((c) => [c.customer_id, c])), [customers]);

  const value = React.useMemo<CRM>(() => {
    const withAudit = (s: Persisted, action: string, detail: string): Persisted => ({
      ...s,
      audit: [{ id: uid("a"), at: now(), action, detail }, ...s.audit].slice(0, 500),
    });
    return {
      customers,
      byId,
      rows,
      dataSource: state.rows ? "imported" : "bundled",
      campaigns: state.campaigns,
      loyaltyTxns: state.loyaltyTxns,
      consentLog: state.consentLog,
      notes: state.notes,
      audit: state.audit,
      erased: state.erased,

      addCampaign(c) {
        const created: Campaign = { ...c, id: uid("cmp"), createdAt: now() };
        setState((s) => withAudit({ ...s, campaigns: [created, ...s.campaigns] }, "campaign.create", created.name));
        return created;
      },
      updateCampaign(id, patch) {
        setState((s) => ({ ...s, campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
      },
      deleteCampaign(id) {
        setState((s) =>
          withAudit({ ...s, campaigns: s.campaigns.filter((c) => c.id !== id) }, "campaign.delete", id),
        );
      },
      adjustPoints(customerId, points, reason) {
        const t: LoyaltyTxn = { id: uid("lt"), customer_id: customerId, points, reason, at: now() };
        setState((s) => ({ ...s, loyaltyTxns: [t, ...s.loyaltyTxns] }));
      },
      adjustPointsBulk(entries, reason) {
        const at = now();
        const txns = entries.map((e) => ({ id: uid("lt"), customer_id: e.customerId, points: e.points, reason, at }));
        setState((s) =>
          withAudit({ ...s, loyaltyTxns: [...txns, ...s.loyaltyTxns] }, "loyalty.bulk", `${entries.length} customers: ${reason}`),
        );
      },
      setConsent(customerId, granted, source) {
        const ev: ConsentEvent = { id: uid("ce"), customer_id: customerId, granted, source, at: now() };
        setState((s) => ({
          ...s,
          consent: { ...s.consent, [customerId]: granted },
          consentLog: [ev, ...s.consentLog].slice(0, 2000),
        }));
      },
      addNote(customerId, text) {
        const n: Note = { id: uid("n"), customer_id: customerId, text, at: now() };
        setState((s) => ({ ...s, notes: [n, ...s.notes] }));
      },
      importRows(incoming, mode) {
        setState((s) => {
          let next: CustomerRow[];
          if (mode === "replace") next = incoming;
          else {
            const map = new Map((s.rows ?? BUNDLED_ROWS).map((r) => [r.customer_id, r]));
            for (const r of incoming) map.set(r.customer_id, r);
            next = [...map.values()];
          }
          return withAudit({ ...s, rows: next }, `data.import.${mode}`, `${incoming.length} rows`);
        });
      },
      eraseCustomer(customerId) {
        setState((s) =>
          withAudit(
            {
              ...s,
              erased: [...s.erased, customerId],
              notes: s.notes.filter((n) => n.customer_id !== customerId),
              loyaltyTxns: s.loyaltyTxns.filter((t) => t.customer_id !== customerId),
            },
            "privacy.erase",
            customerId,
          ),
        );
      },
      log(action, detail) {
        setState((s) => withAudit(s, action, detail));
      },
      resetDemo() {
        setState(EMPTY);
      },
    };
  }, [customers, byId, rows, state]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCRM(): CRM {
  const v = React.useContext(Ctx);
  if (!v) throw new Error("useCRM must be used inside <CRMProvider>");
  return v;
}

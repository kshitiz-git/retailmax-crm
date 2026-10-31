import * as React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronsUpDown,
  Download,
  Search,
  SearchX,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { ConsentIcon, RiskBadge, SegmentBadge, TierBadge, segmentLabel } from "@/components/customers/badges";
import {
  RISK_BANDS,
  activeFilterCount,
  applyFilters,
  parseFilters,
  sortCustomers,
  type SortKey,
  type SortState,
} from "@/components/customers/filters";
import { Stagger, StaggerItem } from "@/components/motion/primitives";
import { EmptyState, PageHeader } from "@/components/shell/page-scaffold";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { customersToCsv, downloadText } from "@/lib/data/csv";
import { AGE_GROUPS, LOYALTY_TIERS, REGIONS, SEGMENTS, type Customer } from "@/lib/data/types";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useCRM } from "@/lib/store";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 25;

/** Columns that read best largest-first the first time they are clicked. */
const DESC_FIRST: SortKey[] = ["orders", "aov", "value", "points", "churn", "tier", "consent"];

const COLUMNS: Array<{ key: SortKey; label: string; numeric?: boolean; hint?: string }> = [
  { key: "customer_id", label: "Customer ID" },
  { key: "segment", label: "Segment", hint: "Segment computed by the CRM from R and F scores" },
  { key: "region", label: "Region" },
  { key: "age", label: "Age" },
  { key: "orders", label: "Orders", numeric: true },
  { key: "aov", label: "AOV", numeric: true, hint: "Average order value" },
  { key: "value", label: "Lifetime value", numeric: true },
  { key: "recency", label: "Last purchase", numeric: true },
  { key: "points", label: "Points", numeric: true },
  { key: "tier", label: "Tier" },
  { key: "churn", label: "Churn risk", numeric: true },
  { key: "consent", label: "Consent" },
];

function SortHead({
  col,
  sort,
  onSort,
}: {
  col: (typeof COLUMNS)[number];
  sort: SortState;
  onSort: (k: SortKey) => void;
}) {
  const active = sort.key === col.key;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ChevronUp : ChevronDown;
  return (
    <TableHead
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={cn("whitespace-nowrap px-3 text-xs", col.numeric && "text-right")}
    >
      <button
        type="button"
        onClick={() => onSort(col.key)}
        title={col.hint ? `${col.hint}. Click to sort.` : "Click to sort"}
        className={cn(
          "inline-flex cursor-pointer items-center gap-1 rounded-sm font-medium transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          active && "text-foreground",
        )}
      >
        {col.label}
        <Icon aria-hidden className={cn("size-3.5", !active && "opacity-50")} />
      </button>
    </TableHead>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <StaggerItem className="soft-card p-4">
      <p className="text-micro text-text-2">{label}</p>
      <p className="metric mt-2.5 text-[21px] text-foreground [overflow-wrap:anywhere] sm:text-[26px]">{value}</p>
      {sub && <p className="mt-1.5 text-[11.5px] text-text-3">{sub}</p>}
    </StaggerItem>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id} className="text-[11px] font-medium text-text-2">
        {label}
      </Label>
      <Select value={value || "all"} onValueChange={onChange}>
        <SelectTrigger id={id} aria-label={label} className="h-9 bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const Row = React.memo(function Row({ c, onOpen }: { c: Customer; onOpen: (id: string) => void }) {
  const pct = Math.round(c.churnProb * 100);
  return (
    <TableRow
      className="cursor-pointer"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) return;
        onOpen(c.customer_id);
      }}
    >
      <TableCell className="px-3 font-medium">
        <Link
          to={`/customers/${encodeURIComponent(c.customer_id)}`}
          className="rounded-sm text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {c.customer_id}
        </Link>
      </TableCell>
      <TableCell className="px-3">
        <SegmentBadge segment={c.computedSegment} />
      </TableCell>
      <TableCell className="px-3 text-text-2">{c.region}</TableCell>
      <TableCell className="px-3 text-text-2 tnum">{c.age_group}</TableCell>
      <TableCell className="px-3 text-right tnum">{formatNumber(c.purchase_freq)}</TableCell>
      <TableCell className="px-3 text-right tnum">{formatCurrency(c.avg_order_value)}</TableCell>
      <TableCell className="px-3 text-right font-medium tnum">{formatCurrency(c.monetary)}</TableCell>
      <TableCell className="px-3 text-right text-text-2 tnum">{formatNumber(c.last_purchase_days)}d ago</TableCell>
      <TableCell className="px-3 text-right tnum">{formatNumber(c.points)}</TableCell>
      <TableCell className="px-3">
        <TierBadge tier={c.tier} />
      </TableCell>
      <TableCell className="px-3">
        <div className="flex items-center justify-end gap-2">
          <span className="w-9 text-right tnum">{pct}%</span>
          <RiskBadge band={c.riskBand} />
        </div>
      </TableCell>
      <TableCell className="px-3 text-center">
        <ConsentIcon granted={c.consent} />
      </TableCell>
    </TableRow>
  );
});

export default function Customers() {
  const crm = useCRM();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();

  const urlFilters = React.useMemo(() => parseFilters(sp), [sp]);

  // Search text is local so typing never lags; it is mirrored to the URL after a short pause.
  const [qInput, setQInput] = React.useState(urlFilters.q);
  // Last value this page wrote to the URL. A URL value that differs came from outside (top-bar search, a link).
  const lastWritten = React.useRef(urlFilters.q.trim());
  React.useEffect(() => {
    const fromUrl = urlFilters.q.trim();
    if (fromUrl === lastWritten.current) return;
    lastWritten.current = fromUrl;
    setQInput(urlFilters.q);
  }, [urlFilters.q]);

  const setParam = React.useCallback(
    (key: string, value: string) => {
      setSp(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value && value !== "all") next.set(key, value);
          else next.delete(key);
          return next;
        },
        { replace: true },
      );
    },
    [setSp],
  );

  React.useEffect(() => {
    const t = setTimeout(() => {
      const v = qInput.trim();
      if (v === lastWritten.current) return;
      lastWritten.current = v;
      setParam("q", v);
    }, 250);
    return () => clearTimeout(t);
    // Only typing should schedule a write; URL-driven changes are handled by the effect above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);

  const deferredQ = React.useDeferredValue(qInput);
  const filters = React.useMemo(() => ({ ...urlFilters, q: deferredQ }), [urlFilters, deferredQ]);

  const [sort, setSort] = React.useState<SortState>({ key: "customer_id", dir: "asc" });
  const onSort = React.useCallback((key: SortKey) => {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key, dir: DESC_FIRST.includes(key) ? "desc" : "asc" },
    );
  }, []);

  const filtered = React.useMemo(() => applyFilters(crm.customers, filters), [crm.customers, filters]);
  const sorted = React.useMemo(() => sortCustomers(filtered, sort), [filtered, sort]);

  const summary = React.useMemo(() => {
    let value = 0;
    let churn = 0;
    let consented = 0;
    for (const c of filtered) {
      value += c.monetary;
      churn += c.churnProb;
      if (c.consent) consented++;
    }
    const n = filtered.length;
    return { n, value, avgChurn: n ? (churn / n) * 100 : 0, consented };
  }, [filtered]);

  // A page belongs to one filter+sort combination; a new combination starts at page 1 with no extra render.
  const key = `${filters.q}|${filters.segment}|${filters.region}|${filters.age}|${filters.tier}|${filters.risk}|${filters.consent}|${sort.key}|${sort.dir}`;
  const [pageState, setPageState] = React.useState({ key, page: 1 });
  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const page = Math.min(pageState.key === key ? pageState.page : 1, pageCount);
  const setPage = (p: number) => setPageState({ key, page: Math.min(Math.max(1, p), pageCount) });

  const start = (page - 1) * PAGE_SIZE;
  const pageRows = React.useMemo(() => sorted.slice(start, start + PAGE_SIZE), [sorted, start]);
  const openCustomer = React.useCallback((id: string) => navigate(`/customers/${encodeURIComponent(id)}`), [navigate]);

  const nActive = activeFilterCount({ ...urlFilters, q: qInput.trim() });
  const clearAll = () => {
    setQInput("");
    lastWritten.current = "";
    setSp(new URLSearchParams(), { replace: true });
  };

  const exportCsv = () => {
    downloadText("retailmax-customers.csv", customersToCsv(filtered));
    toast.success(`Exported ${formatNumber(filtered.length)} customers`, { description: "retailmax-customers.csv" });
  };

  const total = crm.customers.length;

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow="Customers"
        title="All customers"
        description="Search, filter and sort every customer. Open a row for the full Customer 360 view."
        actions={
          <Button onClick={exportCsv} disabled={filtered.length === 0} variant="outline" size="sm">
            <Download /> Export filtered CSV
          </Button>
        }
      />

      <Stagger className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Customers"
          value={formatNumber(summary.n)}
          sub={nActive ? `of ${formatNumber(total)} in total` : "in the whole base"}
        />
        <Stat label="Total lifetime value" value={formatCurrency(summary.value)} sub="orders × average order value" />
        <Stat label="Avg churn risk" value={`${summary.avgChurn.toFixed(1)}%`} sub="mean model probability" />
        <Stat
          label="With consent"
          value={summary.n ? `${Math.round((summary.consented / summary.n) * 100)}%` : "0%"}
          sub={`${formatNumber(summary.consented)} can be contacted`}
        />
      </Stagger>

      <section aria-label="Filters" className="soft-card mt-5 p-4">
        <div className="grid grid-cols-2 items-end gap-3 md:grid-cols-4 xl:grid-cols-8">
          <div className="col-span-2 min-w-0 space-y-1.5">
            <Label htmlFor="cust-search" className="text-[11px] font-medium text-text-2">
              Search by customer ID
            </Label>
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                id="cust-search"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="e.g. C00042"
                autoComplete="off"
                className="h-9 bg-background pl-8"
              />
            </div>
          </div>
          <FilterSelect
            id="f-segment"
            label="Segment"
            value={urlFilters.segment}
            onChange={(v) => setParam("segment", v)}
            options={SEGMENTS.map((s) => ({ value: s, label: segmentLabel(s) }))}
          />
          <FilterSelect
            id="f-region"
            label="Region"
            value={urlFilters.region}
            onChange={(v) => setParam("region", v)}
            options={REGIONS.map((r) => ({ value: r, label: r }))}
          />
          <FilterSelect
            id="f-age"
            label="Age group"
            value={urlFilters.age}
            onChange={(v) => setParam("age", v)}
            options={AGE_GROUPS.map((a) => ({ value: a, label: a }))}
          />
          <FilterSelect
            id="f-tier"
            label="Loyalty tier"
            value={urlFilters.tier}
            onChange={(v) => setParam("tier", v)}
            options={LOYALTY_TIERS.map((t) => ({ value: t, label: t }))}
          />
          <FilterSelect
            id="f-risk"
            label="Churn risk"
            value={urlFilters.risk}
            onChange={(v) => setParam("risk", v)}
            options={RISK_BANDS.map((b) => ({ value: b, label: b }))}
          />
          <FilterSelect
            id="f-consent"
            label="Consent"
            value={urlFilters.consent}
            onChange={(v) => setParam("consent", v)}
            options={[
              { value: "yes", label: "Consent given" },
              { value: "no", label: "No consent" },
            ]}
          />
        </div>
        {nActive > 0 && (
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-text-2">
            <span>
              {nActive} filter{nActive > 1 ? "s" : ""} on · {formatNumber(summary.n)} match
            </span>
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <X /> Clear filters
            </Button>
          </div>
        )}
      </section>

      <section aria-label="Customer list" className="soft-card mt-5 overflow-hidden">
        {sorted.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={SearchX}
              title="No customers match these filters"
              description="Try a shorter ID or remove a filter to see more customers."
              primaryLabel="Clear filters"
              onPrimary={clearAll}
              className="py-12"
            />
          </div>
        ) : (
          <>
            <Table className="min-w-[1180px]">
              <TableHeader className="bg-surface-2/60">
                <TableRow className="hover:bg-transparent">
                  {COLUMNS.map((col) => (
                    <SortHead key={col.key} col={col} sort={sort} onSort={onSort} />
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.map((c) => (
                  <Row key={c.customer_id} c={c} onOpen={openCustomer} />
                ))}
              </TableBody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
              <p className="text-xs text-text-2" aria-live="polite">
                Showing {formatNumber(start + 1)}–{formatNumber(Math.min(start + PAGE_SIZE, sorted.length))} of{" "}
                {formatNumber(sorted.length)}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page <= 1}>
                  <ChevronLeft /> Previous
                </Button>
                <span className="px-1 text-xs text-text-2 tnum">
                  Page {formatNumber(page)} of {formatNumber(pageCount)}
                </span>
                <Button variant="outline" size="sm" onClick={() => setPage(page + 1)} disabled={page >= pageCount}>
                  Next <ChevronRight />
                </Button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

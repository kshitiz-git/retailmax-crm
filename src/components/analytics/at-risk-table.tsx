import * as React from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Check, ChevronLeft, ChevronRight, Download, Megaphone, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { downloadText, toCsv } from "@/lib/data/csv";
import { formatNumber, formatPercent } from "@/lib/format";
import { churnContributions } from "@/lib/ml/churn";
import { REGIONS, SEGMENTS, type Customer, type RiskBand, type Segment } from "@/lib/data/types";
import { RiskChip, SegmentChip } from "./bits";
import { RISK_COLOR, SEG_LABEL, reasonFrom, topReason } from "./meta";

const PAGE_SIZE = 20;

function Filter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 w-full min-w-[8.5rem] sm:w-40" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

export function AtRiskTable({
  customers,
  band,
  onBandChange,
}: {
  customers: Customer[];
  band: RiskBand | "all";
  onBandChange: (b: RiskBand | "all") => void;
}) {
  const navigate = useNavigate();
  const [segment, setSegment] = React.useState<Segment | "all">("all");
  const [region, setRegion] = React.useState<string>("all");
  const [page, setPage] = React.useState(0);

  React.useEffect(() => setPage(0), [band, segment, region]);

  const sorted = React.useMemo(() => [...customers].sort((a, b) => b.churnProb - a.churnProb), [customers]);
  const filtered = React.useMemo(
    () =>
      sorted.filter(
        (c) =>
          (band === "all" || c.riskBand === band) &&
          (segment === "all" || c.computedSegment === segment) &&
          (region === "all" || c.region === region),
      ),
    [sorted, band, segment, region],
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const rows = React.useMemo(
    () =>
      filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE).map((c) => ({
        c,
        reason: reasonFrom(c, churnContributions(c)),
      })),
    [filtered, safePage],
  );

  const exportList = () => {
    if (!filtered.length) {
      toast.error("Nothing to export with these filters");
      return;
    }
    const csv = toCsv(
      ["customer_id", "segment", "region", "age_group", "churn_probability_pct", "risk_band", "top_reason", "marketing_consent"],
      filtered.map((c) => [
        c.customer_id,
        SEG_LABEL[c.computedSegment],
        c.region,
        c.age_group,
        (c.churnProb * 100).toFixed(1),
        c.riskBand,
        topReason(c),
        c.consent ? "yes" : "no",
      ]),
    );
    downloadText(`at-risk-customers-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    toast.success(`Exported ${formatNumber(filtered.length)} customers`);
  };

  const campaignQuery = new URLSearchParams({ risk: band === "all" ? "High" : band });
  if (segment !== "all") campaignQuery.set("segment", segment);
  if (region !== "all") campaignQuery.set("region", region);

  const clear = () => {
    onBandChange("all");
    setSegment("all");
    setRegion("all");
  };
  const filtersOn = band !== "all" || segment !== "all" || region !== "all";
  const from = filtered.length ? safePage * PAGE_SIZE + 1 : 0;
  const to = Math.min(filtered.length, (safePage + 1) * PAGE_SIZE);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <Filter
            label="Risk band"
            value={band}
            onChange={(v) => onBandChange(v as RiskBand | "all")}
            options={[
              { value: "all", label: "All bands" },
              { value: "High", label: "High" },
              { value: "Medium", label: "Medium" },
              { value: "Low", label: "Low" },
            ]}
          />
          <Filter
            label="Segment"
            value={segment}
            onChange={(v) => setSegment(v as Segment | "all")}
            options={[{ value: "all", label: "All segments" }, ...SEGMENTS.map((s) => ({ value: s, label: SEG_LABEL[s] }))]}
          />
          <Filter
            label="Region"
            value={region}
            onChange={setRegion}
            options={[{ value: "all", label: "All regions" }, ...REGIONS.map((r) => ({ value: r, label: r }))]}
          />
          {filtersOn && (
            <Button variant="ghost" size="sm" onClick={clear} className="h-9">
              Clear filters
            </Button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportList}>
            <Download /> Export list
          </Button>
          <Button asChild size="sm">
            <Link to={`/campaigns?${campaignQuery.toString()}`}>
              <Megaphone /> Target with win-back campaign
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[14px] border border-border">
        <Table className="min-w-[760px] text-[12.5px]">
          <TableHeader>
            <TableRow className="bg-surface-2/60 hover:bg-surface-2/60">
              <TableHead className="h-9 pl-3">Customer</TableHead>
              <TableHead className="h-9">Segment</TableHead>
              <TableHead className="h-9">Churn probability</TableHead>
              <TableHead className="h-9">Risk</TableHead>
              <TableHead className="h-9">Top reason</TableHead>
              <TableHead className="h-9 pr-3">Marketing consent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No customers match these filters.
                </TableCell>
              </TableRow>
            )}
            {rows.map(({ c, reason }) => (
              <TableRow key={c.customer_id} className="cursor-pointer" onClick={() => navigate(`/customers/${c.customer_id}`)}>
                <TableCell className="py-2 pl-3">
                  <Link
                    to={`/customers/${c.customer_id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="font-mono text-[12px] font-medium text-primary hover:underline"
                  >
                    {c.customer_id}
                  </Link>
                </TableCell>
                <TableCell className="py-2">
                  <SegmentChip segment={c.computedSegment} />
                </TableCell>
                <TableCell className="py-2">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${c.churnProb * 100}%`, backgroundColor: RISK_COLOR[c.riskBand] }}
                      />
                    </div>
                    <span className="font-medium tabular-nums">{formatPercent(c.churnProb * 100)}</span>
                  </div>
                </TableCell>
                <TableCell className="py-2">
                  <RiskChip band={c.riskBand} />
                </TableCell>
                <TableCell className="py-2 text-muted-foreground">{reason}</TableCell>
                <TableCell className="py-2 pr-3">
                  {c.consent ? (
                    <span className="inline-flex items-center gap-1 text-success">
                      <Check className="size-3.5" /> Yes
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <X className="size-3.5" /> No
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted-foreground">
        <p className="tabular-nums" aria-live="polite">
          Showing {formatNumber(from)}-{formatNumber(to)} of {formatNumber(filtered.length)} customers, highest risk first
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft /> Prev
          </Button>
          <span className="tabular-nums">
            Page {safePage + 1} of {pageCount}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(safePage + 1)}
            aria-label="Next page"
          >
            Next <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

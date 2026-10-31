import { useState, type ReactNode } from "react";
import { Copy, Rocket, ShieldCheck, Trash2 } from "lucide-react";

import { FunnelPanel } from "@/components/panels/charts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SEGMENTS, type Campaign, type CampaignResults, type Segment } from "@/lib/data/types";
import { formatCurrency, formatIST, formatNumber, formatPercent } from "@/lib/format";
import { conversionPct, filterSummary } from "./campaign-card";
import { CHANNEL_ICON, segLabel } from "./meta";
import type { StoredResults } from "./simulate";
import { StatusBadge } from "./status-badge";

function funnelStages(r: CampaignResults) {
  const steps: Array<[string, number]> = [
    ["Sent", r.sent],
    ["Delivered", r.delivered],
    ["Opened", r.opened],
    ["Clicked", r.clicked],
    ["Converted", r.converted],
  ];
  return steps.map(([stage, value], i) => {
    const prev = i === 0 ? value : steps[i - 1]![1];
    return {
      stage,
      value,
      pct: r.sent > 0 ? Math.round((value / r.sent) * 100) : 0,
      drop: i === 0 || prev === 0 ? 0 : Math.round((1 - value / prev) * 100),
    };
  });
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[10.5px] uppercase tracking-wide text-text-3">{label}</p>
      <p className="mt-1 text-[13px] font-medium text-foreground">{value}</p>
    </div>
  );
}

export function CampaignDetailSheet({
  campaign,
  onClose,
  onDuplicate,
  onDelete,
  onLaunch,
}: {
  campaign: Campaign | null;
  onClose: () => void;
  onDuplicate: (c: Campaign) => void;
  onDelete: (c: Campaign) => void;
  onLaunch: (c: Campaign) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const c = campaign;
  const r = c?.results as StoredResults | undefined;
  const Icon = c ? CHANNEL_ICON[c.channel] : null;
  const excluded = c ? Math.max(0, c.audienceSize - c.consentedSize) : 0;
  const consentShare = c && c.audienceSize > 0 ? (c.consentedSize / c.audienceSize) * 100 : 0;
  const segRows = r?.bySegment
    ? SEGMENTS.filter((s) => r.bySegment[s]).map((s) => [s, r.bySegment[s]!] as [Segment, CampaignResults])
    : [];

  return (
    <>
      <Sheet open={!!c} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {c && (
            <>
              <SheetHeader className="pr-8">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={c.status} />
                  <Badge variant="outline" className="gap-1 rounded-full text-[11px] font-medium">
                    {Icon && <Icon className="size-3" aria-hidden />}
                    {c.channel}
                  </Badge>
                </div>
                <SheetTitle className="font-display text-xl tracking-tight">{c.name}</SheetTitle>
                <SheetDescription>
                  Created {formatIST(c.createdAt)}
                  {c.scheduledFor && c.status === "Scheduled" ? ` · scheduled for ${formatIST(c.scheduledFor, false)}` : ""}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-5 space-y-6">
                <section aria-label="Offer" className="rounded-[14px] bg-surface-2 p-4">
                  <p className="text-[13px] leading-relaxed text-foreground">{c.offer || "No offer text."}</p>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Fact label="Discount" value={`${c.discountPct}%`} />
                    <Fact label="Points multiplier" value={`${c.pointsMultiplier}x`} />
                  </div>
                </section>

                <section aria-label="Audience">
                  <h3 className="text-h2">Audience</h3>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {c.segments.map((s) => (
                      <Badge key={s} variant="secondary" className="rounded-full text-[11px] font-medium">
                        {segLabel(s)}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-2 text-[12px] text-text-3">{filterSummary(c)}</p>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <Fact label="Matched" value={formatNumber(c.audienceSize)} />
                    <Fact label="Contacted (consent)" value={formatNumber(c.consentedSize)} />
                    <Fact label="Excluded (no consent)" value={formatNumber(excluded)} />
                  </div>
                  <Progress
                    value={consentShare}
                    className="mt-3 h-1.5 bg-surface-3"
                    aria-label="Share of matched customers with consent"
                  />
                  <p className="mt-2 flex items-start gap-1.5 text-[11.5px] text-text-3">
                    <ShieldCheck className="mt-px size-3.5 shrink-0 text-success" aria-hidden />
                    {formatPercent(consentShare, 0)} of matched customers gave marketing consent. The rest were left out
                    (DPDP Act 2023).
                  </p>
                </section>

                {c.status === "Running" && (
                  <section aria-live="polite" className="rounded-[14px] border border-border p-4 text-[13px] text-text-2">
                    Sending now. Results appear here in a moment.
                  </section>
                )}

                {c.results && (
                  <>
                    <Separator />
                    <section aria-label="Results">
                      <h3 className="text-h2">Results</h3>
                      <div className="mt-3 grid grid-cols-3 gap-3">
                        <Fact label="Revenue" value={formatCurrency(c.results.revenue)} />
                        <Fact label="Conversion" value={formatPercent(conversionPct(c.results))} />
                        <Fact label="Points awarded" value={r?.pointsAwarded != null ? formatNumber(r.pointsAwarded) : "-"} />
                      </div>
                      <div className="mt-5">
                        <FunnelPanel stages={funnelStages(c.results)} />
                      </div>
                    </section>

                    {segRows.length > 0 && (
                      <section aria-label="Results by segment">
                        <h3 className="text-h2">Results by segment</h3>
                        <div className="mt-2">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Segment</TableHead>
                                <TableHead className="text-right">Sent</TableHead>
                                <TableHead className="text-right">Opened</TableHead>
                                <TableHead className="text-right">Clicked</TableHead>
                                <TableHead className="text-right">Bought</TableHead>
                                <TableHead className="text-right">Conv.</TableHead>
                                <TableHead className="text-right">Revenue</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {segRows.map(([s, row]) => (
                                <TableRow key={s}>
                                  <TableCell className="font-medium">{segLabel(s)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatNumber(row.sent)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatNumber(row.opened)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatNumber(row.clicked)}</TableCell>
                                  <TableCell className="text-right tabular-nums">{formatNumber(row.converted)}</TableCell>
                                  <TableCell className="text-right tabular-nums">
                                    {formatPercent(conversionPct(row))}
                                  </TableCell>
                                  <TableCell className="text-right tabular-nums">{formatCurrency(row.revenue)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        <p className="mt-2 text-[11px] text-text-3">
                          Simulated results: fixed rates per channel and segment, seeded by the campaign id.
                        </p>
                      </section>
                    )}
                  </>
                )}

                <Separator />
                <div className="flex flex-wrap items-center gap-2 pb-2">
                  {(c.status === "Draft" || c.status === "Scheduled") && (
                    <Button type="button" onClick={() => onLaunch(c)} disabled={c.consentedSize === 0}>
                      <Rocket className="size-4" />
                      Launch now
                    </Button>
                  )}
                  <Button type="button" variant="outline" onClick={() => onDuplicate(c)}>
                    <Copy className="size-4" />
                    Duplicate
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="ml-auto text-danger hover:text-danger"
                    onClick={() => setConfirmDelete(true)}
                  >
                    <Trash2 className="size-4" />
                    Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              {c ? `"${c.name}" and its results will be removed.` : ""} Loyalty points already awarded stay in the
              ledger.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep campaign</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (c) onDelete(c);
                setConfirmDelete(false);
              }}
            >
              Delete campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

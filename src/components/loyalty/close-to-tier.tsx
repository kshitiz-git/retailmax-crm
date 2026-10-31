import { Link } from "react-router-dom";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Customer, LoyaltyTier } from "@/lib/data/types";
import { formatNumber } from "@/lib/format";
import { useCRM } from "@/lib/store";
import { Pager, usePaged } from "./pager";
import { NEAR_TIER_WINDOW, NUDGE_BONUS } from "./rules";
import { TierBadge } from "./tier-badge";

export interface NearTierRow {
  customer: Customer;
  next: LoyaltyTier;
  /** Points still missing for the next tier. */
  need: number;
}

const segLabel = (s: string) => s.replace("_", " ");

/** Customers within NEAR_TIER_WINDOW points of the next tier, closest first. A nudge gives bonus points. */
export function CloseToTier({ rows }: { rows: NearTierRow[] }) {
  const { adjustPoints } = useCRM();
  const paged = usePaged(rows, 8);

  const nudge = (r: NearTierRow) => {
    const id = r.customer.customer_id;
    adjustPoints(id, NUDGE_BONUS, `Tier nudge: bonus towards ${r.next}`);
    toast.success(`Nudge sent to ${id}`, {
      description:
        r.need <= NUDGE_BONUS
          ? `+${NUDGE_BONUS} bonus points. ${id} now reaches ${r.next}.`
          : `+${NUDGE_BONUS} bonus points. ${formatNumber(r.need - NUDGE_BONUS)} more to reach ${r.next}.`,
    });
  };

  if (rows.length === 0) {
    return (
      <p className="rounded-[14px] bg-surface-2 px-4 py-6 text-center text-[13px] text-text-2">
        No one is within {NEAR_TIER_WINDOW} points of the next tier right now.
      </p>
    );
  }

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Segment</TableHead>
            <TableHead>Tier</TableHead>
            <TableHead className="text-right">Points</TableHead>
            <TableHead className="text-right">To next tier</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.slice.map((r) => {
            const id = r.customer.customer_id;
            return (
              <TableRow key={id}>
                <TableCell>
                  <Link to={`/customers/${id}`} className="font-mono text-[12.5px] font-medium text-primary hover:underline">
                    {id}
                  </Link>
                </TableCell>
                <TableCell className="text-[12.5px] text-text-2">{segLabel(r.customer.computedSegment)}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5">
                    <TierBadge tier={r.customer.tier} />
                    <span className="text-text-3" aria-hidden>
                      to
                    </span>
                    <TierBadge tier={r.next} />
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{formatNumber(r.customer.points)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatNumber(r.need)} pts</TableCell>
                <TableCell className="text-right">
                  {r.customer.consent ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => nudge(r)}>
                      <Send className="size-3.5" />
                      Nudge +{NUDGE_BONUS}
                    </Button>
                  ) : (
                    <Badge
                      variant="outline"
                      className="rounded-full text-[11px] font-medium text-text-3"
                      title="No marketing consent, so no nudge can be sent"
                    >
                      No consent
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <Pager {...paged} onPage={paged.setPage} label="customers" />
    </div>
  );
}

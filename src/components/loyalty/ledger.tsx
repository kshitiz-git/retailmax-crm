import * as React from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatIST, formatNumber } from "@/lib/format";
import { useCRM } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Pager, usePaged } from "./pager";

/** Every points movement, newest first, 20 per page. */
export function Ledger() {
  const { loyaltyTxns, byId } = useCRM();
  const [q, setQ] = React.useState("");

  const sorted = React.useMemo(
    () => [...loyaltyTxns].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0)),
    [loyaltyTxns],
  );
  const filtered = React.useMemo(() => {
    const needle = q.trim().toUpperCase();
    return needle ? sorted.filter((t) => t.customer_id.toUpperCase().includes(needle)) : sorted;
  }, [sorted, q]);
  const paged = usePaged(filtered, 20);

  return (
    <div>
      <div className="relative mb-4 max-w-xs">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            paged.setPage(0);
          }}
          placeholder="Filter by customer ID"
          aria-label="Filter ledger by customer ID"
          className="pl-8"
        />
      </div>

      {loyaltyTxns.length === 0 ? (
        <p className="rounded-[14px] bg-surface-2 px-4 py-8 text-center text-[13px] text-text-2">
          No points movements yet. Award points above, nudge a customer, or launch a campaign and the ledger fills up.
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-[14px] bg-surface-2 px-4 py-8 text-center text-[13px] text-text-2">
          No transactions for &quot;{q.trim()}&quot;.
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When (IST)</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Points</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.slice.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap text-[12.5px] text-text-2">{formatIST(t.at)}</TableCell>
                  <TableCell>
                    {byId.has(t.customer_id) ? (
                      <Link
                        to={`/customers/${t.customer_id}`}
                        className="font-mono text-[12.5px] font-medium text-primary hover:underline"
                      >
                        {t.customer_id}
                      </Link>
                    ) : (
                      <span className="font-mono text-[12.5px] text-text-3">{t.customer_id}</span>
                    )}
                  </TableCell>
                  <TableCell
                    className={cn("text-right font-medium tabular-nums", t.points >= 0 ? "text-success" : "text-danger")}
                  >
                    {t.points >= 0 ? "+" : ""}
                    {formatNumber(t.points)}
                  </TableCell>
                  <TableCell className="text-[12.5px] text-text-2">{t.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pager {...paged} onPage={paged.setPage} label="transactions" />
        </>
      )}
    </div>
  );
}

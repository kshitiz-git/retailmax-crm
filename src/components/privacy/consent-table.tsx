import * as React from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { toast } from "sonner";

import { Pager, usePaged } from "@/components/loyalty/pager";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { useCRM } from "@/lib/store";

const SOURCE = "Privacy console";
type Filter = "all" | "yes" | "no";

/** Search any customer by ID and grant or withdraw marketing consent. 20 rows per page. */
export function ConsentTable() {
  const { customers, setConsent } = useCRM();
  const [q, setQ] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("all");

  const rows = React.useMemo(() => {
    const needle = q.trim().toUpperCase();
    return customers.filter(
      (c) =>
        (filter === "all" || (filter === "yes") === c.consent) &&
        (!needle || c.customer_id.toUpperCase().includes(needle)),
    );
  }, [customers, q, filter]);
  const paged = usePaged(rows, 20);

  const toggle = (id: string, granted: boolean) => {
    setConsent(id, granted, SOURCE);
    toast.success(granted ? `Consent granted for ${id}` : `Consent withdrawn for ${id}`, {
      description: granted
        ? "This customer can now receive campaigns."
        : "This customer will be skipped by every campaign.",
    });
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
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
            placeholder="Search by customer ID, e.g. C00042"
            aria-label="Search customers by ID"
            className="pl-8"
          />
        </div>
        <Select
          value={filter}
          onValueChange={(v) => {
            setFilter(v as Filter);
            paged.setPage(0);
          }}
        >
          <SelectTrigger className="w-44" aria-label="Filter by consent status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All customers</SelectItem>
            <SelectItem value="yes">Consented</SelectItem>
            <SelectItem value="no">No consent</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[12px] text-text-2 tabular-nums">{formatNumber(rows.length)} matching</p>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-[14px] bg-surface-2 px-4 py-8 text-center text-[13px] text-text-2">
          No customers match this search.
        </p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Region</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Marketing consent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.slice.map((c) => (
                <TableRow key={c.customer_id}>
                  <TableCell>
                    <Link
                      to={`/customers/${c.customer_id}`}
                      className="font-mono text-[12.5px] font-medium text-primary hover:underline"
                    >
                      {c.customer_id}
                    </Link>
                  </TableCell>
                  <TableCell className="text-[12.5px] text-text-2">{c.computedSegment.replace("_", " ")}</TableCell>
                  <TableCell className="text-[12.5px] text-text-2">{c.region}</TableCell>
                  <TableCell>
                    {c.consent ? (
                      <Badge variant="outline" className="rounded-full border-transparent bg-success/12 text-[11px] text-success">
                        Consented
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="rounded-full bg-surface-2 text-[11px] text-text-2">
                        No consent
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Switch
                      checked={c.consent}
                      onCheckedChange={(v) => toggle(c.customer_id, v)}
                      aria-label={`Marketing consent for ${c.customer_id}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Pager {...paged} onPage={paged.setPage} label="customers" />
        </>
      )}
    </div>
  );
}

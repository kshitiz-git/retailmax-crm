import * as React from "react";
import { Link } from "react-router-dom";

import { Pager, usePaged } from "@/components/loyalty/pager";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatIST, formatNumber } from "@/lib/format";
import { useCRM } from "@/lib/store";

const newestFirst = <T extends { at: string }>(items: readonly T[]) =>
  [...items].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

function CustomerRef({ id }: { id: string }) {
  const { byId } = useCRM();
  return byId.has(id) ? (
    <Link to={`/customers/${id}`} className="font-mono text-[12.5px] font-medium text-primary hover:underline">
      {id}
    </Link>
  ) : (
    <span className="font-mono text-[12.5px] text-text-3" title="This customer record no longer exists">
      {id}
    </span>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-[14px] bg-surface-2 px-4 py-8 text-center text-[13px] text-text-2">{children}</p>;
}

function ConsentLog() {
  const { consentLog } = useCRM();
  const rows = React.useMemo(() => newestFirst(consentLog), [consentLog]);
  const paged = usePaged(rows, 10);
  if (rows.length === 0) {
    return <Empty>No consent changes yet. Switch a customer on or off above and it shows up here.</Empty>;
  }
  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When (IST)</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Change</TableHead>
            <TableHead>Source</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.slice.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="whitespace-nowrap text-[12.5px] text-text-2">{formatIST(e.at)}</TableCell>
              <TableCell>
                <CustomerRef id={e.customer_id} />
              </TableCell>
              <TableCell>
                {e.granted ? (
                  <Badge variant="outline" className="rounded-full border-transparent bg-success/12 text-[11px] text-success">
                    Granted
                  </Badge>
                ) : (
                  <Badge variant="outline" className="rounded-full border-transparent bg-danger/12 text-[11px] text-danger">
                    Withdrawn
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-[12.5px] text-text-2">{e.source}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pager {...paged} onPage={paged.setPage} label="events" />
    </div>
  );
}

function AuditLog() {
  const { audit } = useCRM();
  const rows = React.useMemo(() => newestFirst(audit), [audit]);
  const paged = usePaged(rows, 10);
  if (rows.length === 0) {
    return <Empty>The audit trail is empty. Launch a campaign, import data or erase a customer and it is recorded here.</Empty>;
  }
  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When (IST)</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Detail</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paged.slice.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="whitespace-nowrap text-[12.5px] text-text-2">{formatIST(e.at)}</TableCell>
              <TableCell>
                <code className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11.5px]">{e.action}</code>
              </TableCell>
              <TableCell className="text-[12.5px] text-text-2">{e.detail}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Pager {...paged} onPage={paged.setPage} label="entries" />
    </div>
  );
}

/** Consent log and audit log in one tabbed card, newest first, 10 per page. */
export function Logs() {
  const { consentLog, audit } = useCRM();
  return (
    <Tabs defaultValue="consent">
      <TabsList>
        <TabsTrigger value="consent">Consent log ({formatNumber(consentLog.length)})</TabsTrigger>
        <TabsTrigger value="audit">Audit log ({formatNumber(audit.length)})</TabsTrigger>
      </TabsList>
      <TabsContent value="consent" className="mt-4">
        <ConsentLog />
      </TabsContent>
      <TabsContent value="audit" className="mt-4">
        <AuditLog />
      </TabsContent>
    </Tabs>
  );
}

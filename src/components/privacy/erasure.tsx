import * as React from "react";
import { Eraser, Info, Search, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useCRM } from "@/lib/store";

/** Right to erasure: look up an ID, show exactly what goes, confirm, erase. */
export function Erasure() {
  const { byId, notes, loyaltyTxns, consentLog, erased, eraseCustomer } = useCRM();
  const [input, setInput] = React.useState("");
  const [confirm, setConfirm] = React.useState(false);

  const id = input.trim().toUpperCase();
  const customer = id ? byId.get(id) : undefined;
  const alreadyErased = !!id && !customer && erased.includes(id);

  const impact = React.useMemo(() => {
    if (!customer) return null;
    return {
      notes: notes.filter((n) => n.customer_id === id).length,
      txns: loyaltyTxns.filter((t) => t.customer_id === id).length,
      consentEvents: consentLog.filter((e) => e.customer_id === id).length,
    };
  }, [customer, id, notes, loyaltyTxns, consentLog]);

  const erase = () => {
    if (!customer) return;
    eraseCustomer(id);
    toast.success(`${id} erased`, { description: "The record, notes and points history are gone. The erasure is in the audit log." });
    setInput("");
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="erase-id">Customer ID to erase</Label>
        <div className="relative max-w-sm">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="erase-id"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. C00042"
            autoComplete="off"
            spellCheck={false}
            className="pl-8 font-mono uppercase"
          />
        </div>
      </div>

      {!id && (
        <p className="flex items-start gap-2 rounded-[14px] bg-surface-2 px-4 py-3 text-[12.5px] text-text-2">
          <Info className="mt-px size-4 shrink-0 text-primary" aria-hidden />
          Enter an ID to see exactly what an erasure request removes before anything is deleted.
        </p>
      )}

      {id && !customer && (
        <p role="status" className="flex items-start gap-2 rounded-[14px] bg-surface-2 px-4 py-3 text-[12.5px] text-text-2">
          <Info className="mt-px size-4 shrink-0 text-primary" aria-hidden />
          {alreadyErased ? `${id} has already been erased.` : `No customer with the ID ${id}.`}
        </p>
      )}

      {customer && impact && (
        <div className="rounded-[16px] border border-border bg-surface p-4">
          <p className="text-[13px] font-medium">
            <span className="font-mono">{customer.customer_id}</span> · {customer.computedSegment.replace("_", " ")} ·{" "}
            {customer.region} · {customer.age_group}
          </p>

          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-micro text-danger">Will be removed</p>
              <ul className="mt-2 space-y-1.5 text-[12.5px] text-text-2">
                <li>
                  Customer record: {formatNumber(customer.purchase_freq)} purchases, {formatCurrency(customer.monetary)}{" "}
                  lifetime spend
                </li>
                <li>
                  {formatNumber(impact.notes)} {impact.notes === 1 ? "note" : "notes"}
                </li>
                <li>
                  {formatNumber(impact.txns)} loyalty {impact.txns === 1 ? "transaction" : "transactions"} and{" "}
                  {formatNumber(customer.points)} points balance
                </li>
                <li>Campaign eligibility (no further messages)</li>
              </ul>
            </div>
            <div>
              <p className="text-micro text-text-2">Kept as proof</p>
              <ul className="mt-2 space-y-1.5 text-[12.5px] text-text-2">
                <li>
                  {formatNumber(impact.consentEvents)} consent log{" "}
                  {impact.consentEvents === 1 ? "entry" : "entries"} (anonymised ID only)
                </li>
                <li>One audit entry recording the erasure itself</li>
              </ul>
            </div>
          </div>

          <Button type="button" variant="destructive" className="mt-4" onClick={() => setConfirm(true)}>
            <Eraser className="size-4" />
            Erase {customer.customer_id}
          </Button>
        </div>
      )}

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <TriangleAlert className="size-5 text-danger" aria-hidden />
              Erase {id}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the customer record, notes and points history for {id}. It cannot be undone. The erasure is
              written to the audit log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep customer</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={erase}
            >
              Erase permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

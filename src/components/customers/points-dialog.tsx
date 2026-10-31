import * as React from "react";
import { toast } from "sonner";

import { TierBadge } from "@/components/customers/badges";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { tierFor } from "@/lib/data/derive";
import type { Customer } from "@/lib/data/types";
import { formatNumber } from "@/lib/format";
import { useCRM } from "@/lib/store";
import { cn } from "@/lib/utils";

type Mode = "award" | "redeem";

const MAX_POINTS = 100_000;
const DEFAULT_REASON: Record<Mode, string> = {
  award: "Goodwill award",
  redeem: "Redeemed at store",
};

/** Pure check, exported so the rule has one home: whole number, > 0, capped, never above the balance on redeem. */
export function validatePoints(raw: string, mode: Mode, balance: number): string | null {
  if (!raw.trim()) return "Enter the number of points.";
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) return "Use a whole number above 0.";
  if (n > MAX_POINTS) return `Use ${formatNumber(MAX_POINTS)} points or fewer at a time.`;
  if (mode === "redeem" && n > balance) return `Balance is only ${formatNumber(balance)} points.`;
  return null;
}

function PointsForm({ customer, onDone }: { customer: Customer; onDone: () => void }) {
  const { adjustPoints } = useCRM();
  const [mode, setMode] = React.useState<Mode>("award");
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [reasonEdited, setReasonEdited] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const effectiveReason = reasonEdited ? reason : DEFAULT_REASON[mode];
  const amountError = validatePoints(amount, mode, customer.points);
  const reasonError = effectiveReason.trim() ? null : "Add a short reason for the record.";
  const showAmountError = (submitted || amount !== "") && amountError;

  const n = amountError ? 0 : Number(amount);
  const newBalance = Math.max(0, customer.points + (mode === "award" ? n : -n));
  const newTier = tierFor(newBalance);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (amountError || reasonError) return;
    adjustPoints(customer.customer_id, mode === "award" ? n : -n, effectiveReason.trim());
    toast.success(
      mode === "award"
        ? `Awarded ${formatNumber(n)} points to ${customer.customer_id}`
        : `Redeemed ${formatNumber(n)} points for ${customer.customer_id}`,
      { description: `New balance ${formatNumber(newBalance)} points${newTier !== customer.tier ? ` · now ${newTier}` : ""}` },
    );
    onDone();
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="award">Award points</TabsTrigger>
          <TabsTrigger value="redeem">Redeem points</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="space-y-1.5">
        <Label htmlFor="pts-amount">Points</Label>
        <Input
          id="pts-amount"
          inputMode="numeric"
          autoComplete="off"
          autoFocus
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder={mode === "award" ? "e.g. 500" : `up to ${formatNumber(customer.points)}`}
          aria-invalid={!!showAmountError}
          aria-describedby="pts-amount-help"
        />
        <p
          id="pts-amount-help"
          className={cn("text-xs", showAmountError ? "text-danger" : "text-text-3")}
          role={showAmountError ? "alert" : undefined}
        >
          {showAmountError || `Current balance: ${formatNumber(customer.points)} points.`}
        </p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="pts-reason">Reason</Label>
        <Input
          id="pts-reason"
          value={effectiveReason}
          maxLength={80}
          onChange={(e) => {
            setReason(e.target.value);
            setReasonEdited(true);
          }}
          aria-invalid={submitted && !!reasonError}
          aria-describedby={submitted && reasonError ? "pts-reason-help" : undefined}
        />
        {submitted && reasonError && (
          <p id="pts-reason-help" role="alert" className="text-xs text-danger">
            {reasonError}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2.5 text-[13px]">
        <span className="text-text-2">New balance</span>
        <span className="flex items-center gap-2 font-semibold tnum">
          {formatNumber(newBalance)}
          <TierBadge tier={newTier} />
        </span>
      </div>

      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{mode === "award" ? "Award points" : "Redeem points"}</Button>
      </DialogFooter>
    </form>
  );
}

export function PointsDialog({
  customer,
  open,
  onOpenChange,
}: {
  customer: Customer;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Award or redeem points</DialogTitle>
          <DialogDescription>
            {customer.customer_id} · balance {formatNumber(customer.points)} points. Every change is saved in the activity history.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open, so the form starts fresh every time. */}
        <PointsForm customer={customer} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

import * as React from "react";
import { Award } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LOYALTY_TIERS, SEGMENTS, type Customer } from "@/lib/data/types";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useCRM } from "@/lib/store";
import { pointsToRupees } from "./rules";

const MAX_AWARD = 10_000;
const segLabel = (s: string) => s.replace("_", " ");

function matcher(target: string): (c: Customer) => boolean {
  if (target.startsWith("seg:")) {
    const s = target.slice(4);
    return (c) => c.computedSegment === s;
  }
  if (target.startsWith("tier:")) {
    const t = target.slice(5);
    return (c) => c.tier === t;
  }
  return () => true;
}

/** Credit the same number of points to a segment, a tier or everyone, with a confirm step. */
export function BulkAward({ customers }: { customers: readonly Customer[] }) {
  const { adjustPointsBulk } = useCRM();
  const [target, setTarget] = React.useState("seg:Champion");
  const [pointsText, setPointsText] = React.useState("200");
  const [reason, setReason] = React.useState("Loyalty bonus");
  const [confirm, setConfirm] = React.useState(false);

  const points = Number(pointsText);
  const pointsOk = pointsText.trim() !== "" && Number.isInteger(points) && points >= 1 && points <= MAX_AWARD;
  const reasonOk = reason.trim().length > 0;

  const recipients = React.useMemo(() => customers.filter(matcher(target)), [customers, target]);
  const total = pointsOk ? recipients.length * points : 0;
  const canAward = pointsOk && reasonOk && recipients.length > 0;

  const targetLabel =
    target === "all"
      ? "all customers"
      : target.startsWith("seg:")
        ? `${segLabel(target.slice(4))} customers`
        : `${target.slice(5)} tier members`;

  const award = () => {
    if (!canAward) return;
    adjustPointsBulk(
      recipients.map((c) => ({ customerId: c.customer_id, points })),
      reason.trim(),
    );
    toast.success(`Awarded ${formatNumber(points)} points to ${formatNumber(recipients.length)} customers`, {
      description: `${formatNumber(total)} points in total. Reason: ${reason.trim()}`,
    });
  };

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="award-target">Who gets the points</Label>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger id="award-target">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All customers</SelectItem>
              <SelectGroup>
                <SelectLabel>Segment</SelectLabel>
                {SEGMENTS.map((s) => (
                  <SelectItem key={s} value={`seg:${s}`}>
                    {segLabel(s)}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>Tier</SelectLabel>
                {LOYALTY_TIERS.map((t) => (
                  <SelectItem key={t} value={`tier:${t}`}>
                    {t}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="award-points">Points each</Label>
          <Input
            id="award-points"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_AWARD}
            value={pointsText}
            aria-invalid={!pointsOk}
            onChange={(e) => setPointsText(e.target.value)}
          />
          {!pointsOk && (
            <p role="alert" className="text-[12px] text-danger">
              Enter a whole number from 1 to {formatNumber(MAX_AWARD)}.
            </p>
          )}
        </div>

        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="award-reason">Reason (saved in the ledger)</Label>
          <Input
            id="award-reason"
            value={reason}
            maxLength={80}
            aria-invalid={!reasonOk}
            onChange={(e) => setReason(e.target.value)}
          />
          {!reasonOk && (
            <p role="alert" className="text-[12px] text-danger">
              A reason is required.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[14px] bg-surface-2 px-4 py-3">
        <p className="text-[13px] text-text-2" aria-live="polite">
          <span className="font-semibold text-foreground">{formatNumber(recipients.length)}</span> customers will get{" "}
          <span className="font-semibold text-foreground">{pointsOk ? formatNumber(points) : "-"}</span> points each.
          {pointsOk && recipients.length > 0 && (
            <> Total {formatNumber(total)} points, worth {formatCurrency(pointsToRupees(total))}.</>
          )}
        </p>
        <Button type="button" disabled={!canAward} onClick={() => setConfirm(true)}>
          <Award className="size-4" />
          Award points
        </Button>
      </div>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Award {pointsOk ? formatNumber(points) : ""} points to {targetLabel}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {formatNumber(recipients.length)} customers will each receive {pointsOk ? formatNumber(points) : "-"}{" "}
              points ({formatNumber(total)} in total, worth {formatCurrency(pointsToRupees(total))}). Reason: &quot;
              {reason.trim()}&quot;. Every credit is added to the ledger below.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={award}>Award points</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

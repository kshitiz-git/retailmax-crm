import { CalendarClock, CircleCheck, LoaderCircle, PencilLine } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { CampaignStatus } from "@/lib/data/types";
import { cn } from "@/lib/utils";

const STYLE: Record<CampaignStatus, string> = {
  Draft: "border-border bg-surface-2 text-text-2",
  Scheduled: "border-transparent bg-warning/12 text-warning",
  Running: "border-transparent bg-primary-soft text-primary",
  Completed: "border-transparent bg-success/12 text-success",
};

const ICON = {
  Draft: PencilLine,
  Scheduled: CalendarClock,
  Running: LoaderCircle,
  Completed: CircleCheck,
} as const;

export function StatusBadge({ status, className }: { status: CampaignStatus; className?: string }) {
  const Icon = ICON[status];
  return (
    <Badge variant="outline" className={cn("gap-1 rounded-full px-2.5 py-0.5 text-[11px]", STYLE[status], className)}>
      <Icon className={cn("size-3", status === "Running" && "animate-spin")} aria-hidden />
      {status}
    </Badge>
  );
}

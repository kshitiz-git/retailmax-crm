import type { LucideIcon } from "lucide-react";

import { NumberTicker } from "@/components/motion/number-ticker";
import { SpotlightCard } from "@/components/motion/primitives";
import { IconTile, type IconTone } from "@/components/ui/icon-tile";
import { cn } from "@/lib/utils";

/** Compact KPI tile for real (non-sparkline) numbers: label, big value, one line of context. */
export function StatTile({
  label,
  value,
  format,
  sub,
  icon,
  tone = "primary",
  className,
}: {
  label: string;
  value: number;
  format: (v: number) => string;
  sub?: string;
  icon: LucideIcon;
  tone?: IconTone;
  className?: string;
}) {
  return (
    <SpotlightCard className={cn("flex flex-col justify-between p-5", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-micro text-text-2">{label}</p>
        <IconTile icon={icon} tone={tone} size="sm" />
      </div>
      <p className="metric mt-4 text-[28px] text-foreground">
        <NumberTicker value={value} format={format} />
      </p>
      {sub && <p className="mt-1.5 text-[11.5px] text-text-2">{sub}</p>}
    </SpotlightCard>
  );
}

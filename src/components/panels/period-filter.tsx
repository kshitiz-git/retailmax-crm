import * as React from "react";
import { motion } from "motion/react";
import { PERIOD_LABEL, type Period } from "@/lib/format";
import { cn } from "@/lib/utils";
import { D, E } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/hooks/use-motion-prefs";

const PERIODS: Period[] = ["today", "7d", "30d", "90d"];

export function PeriodFilter({
  value,
  onChange,
  className,
  layoutId = "period-pill",
}: {
  value: Period;
  onChange: (p: Period) => void;
  className?: string;
  layoutId?: string;
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <div
      role="tablist"
      aria-label="Time range"
      className={cn("soft-card inline-flex h-10 items-center gap-0.5 rounded-full px-1", className)}
    >
      {PERIODS.map((p) => {
        const active = p === value;
        return (
          <button
            key={p}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(p)}
            className={cn(
              "relative isolate rounded-full px-3.5 py-1.5 text-[11.5px] font-medium transition-colors",
              active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-primary"
                transition={reduced ? { duration: 0 } : { duration: D.fast, ease: E.out }}
              />
            )}
            <span className="relative">{PERIOD_LABEL[p]}</span>
          </button>
        );
      })}
    </div>
  );
}

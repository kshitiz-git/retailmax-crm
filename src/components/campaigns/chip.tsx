import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Toggle chip used for multi-select filters. A real button with aria-pressed. */
export function Chip({
  active,
  onClick,
  children,
  count,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  count?: number;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors focus-visible:outline-2",
        active
          ? "border-primary/40 bg-primary-soft text-primary"
          : "border-border bg-surface text-text-2 hover:bg-surface-2 hover:text-foreground",
      )}
    >
      {icon}
      {children}
      {count !== undefined && (
        <span className={cn("tabular-nums text-[11px]", active ? "text-primary/80" : "text-text-3")}>{count}</span>
      )}
    </button>
  );
}

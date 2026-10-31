import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Tone = "primary" | "accent" | "success" | "warning" | "danger" | "neutral";

const TONE: Record<Tone, string> = {
  primary: "text-primary bg-primary/10 ring-primary/20",
  accent: "text-accent bg-accent/10 ring-accent/20",
  success: "text-chart-3 bg-chart-3/10 ring-chart-3/20",
  warning: "text-chart-4 bg-chart-4/10 ring-chart-4/20",
  danger: "text-destructive bg-destructive/10 ring-destructive/20",
  neutral: "text-muted-foreground bg-surface-2 ring-border",
};

const SIZE = {
  sm: "size-7 rounded-[9px] [&>svg]:size-3.5",
  md: "size-9 rounded-[11px] [&>svg]:size-4",
  lg: "size-11 rounded-[13px] [&>svg]:size-[18px]",
} as const;

/**
 * The single icon treatment for the app: a soft tinted tile with a hairline
 * ring and a 1.6-weight glyph. Never drop a bare lucide icon into a header.
 */
export function IconTile({
  icon: Icon,
  tone = "primary",
  size = "md",
  className,
}: {
  icon: LucideIcon;
  tone?: Tone;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center ring-1 ring-inset transition-colors duration-200",
        TONE[tone],
        SIZE[size],
        className,
      )}
    >
      <Icon strokeWidth={1.6} />
    </span>
  );
}

export type { Tone as IconTone };

import * as React from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import type { LucideIcon } from "lucide-react";
import { Sparkle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { D, E } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Empty state. Never leave a surface blank. */
export function EmptyState({
  icon = Sparkle,
  title,
  description,
  primaryLabel,
  primaryTo,
  onPrimary,
  secondary,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  primaryLabel?: string;
  primaryTo?: string;
  onPrimary?: () => void;
  secondary?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: D.slow, ease: E.out }}
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-surface/50 px-6 py-16 text-center",
        className,
      )}
    >
      <div aria-hidden className="ambient-wash pointer-events-none absolute inset-0 opacity-70" />
      <IconTile icon={icon} size="lg" tone="primary" />
      <h3 className="font-display mt-4 text-base font-semibold tracking-tight">{title}</h3>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">{description}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {primaryLabel && primaryTo && (
          <Button asChild size="sm">
            <Link to={primaryTo}>{primaryLabel}</Link>
          </Button>
        )}
        {primaryLabel && !primaryTo && (
          <Button size="sm" onClick={onPrimary}>
            {primaryLabel}
          </Button>
        )}
        {secondary}
      </div>
    </motion.div>
  );
}

/** Standard page header: eyebrow, title, description, right-side actions. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", className)}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: D.slow, ease: E.out }}
        className="min-w-0"
      >
        {eyebrow && <p className="text-micro text-primary">{eyebrow}</p>}
        <h1 className="font-display mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[13px] text-muted-foreground">{description}</p>}
      </motion.div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

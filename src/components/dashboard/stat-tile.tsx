import * as React from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, ArrowRight, type LucideIcon } from "lucide-react";

import { SpotlightCard } from "@/components/motion/primitives";
import { NumberTicker } from "@/components/motion/number-ticker";
import type { Tint } from "@/components/panels/panel";
import { cn } from "@/lib/utils";
import type { TileChip } from "./stats";

const TINT_CARD: Record<Tint, string> = {
  pink: "tint-pink",
  mint: "tint-mint",
  lilac: "tint-lilac",
  cream: "tint-cream",
  plain: "",
};

const TINT_INK: Record<Tint, string> = {
  pink: "ink-pink",
  mint: "ink-mint",
  lilac: "ink-lilac",
  cream: "ink-cream",
  plain: "text-primary",
};

export interface StatTileProps {
  label: string;
  value: number;
  format: (v: number) => string;
  /** One line under the number: what the number is. */
  hint: string;
  /** What this tile is compared against, always spelled out in the text. */
  chip?: TileChip;
  icon: LucideIcon;
  tint?: Tint;
  hero?: boolean;
  /** Makes the whole tile a link. */
  to?: string;
  /** Full-precision value for the hover tooltip when `format` shortens it. */
  title?: string;
}

/**
 * KPI card without a sparkline: the dataset has no history, so the card shows
 * a labelled comparison between two real groups instead of an invented trend.
 */
export function StatTile({ label, value, format, hint, chip, icon: Icon, tint = "plain", hero = false, to, title }: StatTileProps) {
  const ChipArrow = chip?.direction === "down" ? ArrowDownRight : chip?.direction === "up" ? ArrowUpRight : ArrowRight;

  const body = (
    <SpotlightCard
      className={cn(
        "group relative flex h-full flex-col p-5",
        hero ? "violet-gradient border-transparent text-primary-foreground" : TINT_CARD[tint],
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className={cn("text-micro", hero ? "text-primary-foreground/80" : "text-text-2")}>{label}</p>
        <span
          aria-hidden
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full",
            hero ? "bg-primary-foreground/20 text-primary-foreground" : cn("bg-surface/85", TINT_INK[tint]),
          )}
        >
          <Icon className="size-3.5" />
        </span>
      </div>

      <p className={cn("metric mt-5 text-[30px]", hero ? "text-primary-foreground" : "text-foreground")} title={title}>
        <NumberTicker value={value} format={format} />
      </p>
      <p className={cn("mt-1.5 text-[11.5px]", hero ? "text-primary-foreground/80" : "text-text-2")}>{hint}</p>

      {chip && (
        <span
          className={cn(
            "mt-3 inline-flex max-w-full items-start gap-1 self-start rounded-xl px-2.5 py-1 text-[10.5px] font-semibold leading-snug",
            hero
              ? "bg-primary-foreground/20 text-primary-foreground"
              : cn(
                  "bg-surface/85",
                  chip.tone === "good" && "text-success",
                  chip.tone === "bad" && "text-danger",
                  chip.tone === "neutral" && "text-text-2",
                ),
          )}
        >
          <ChipArrow className="mt-px size-3 shrink-0" aria-hidden />
          <span className="min-w-0">{chip.text}</span>
        </span>
      )}
    </SpotlightCard>
  );

  if (!to) return body;
  return (
    <Link to={to} className="block h-full rounded-[var(--r-xl)]">
      {body}
    </Link>
  );
}

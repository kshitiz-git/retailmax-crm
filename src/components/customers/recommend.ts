import { Gift, RefreshCw, Send, ShieldOff, Sparkles, Star, UserRound, type LucideIcon } from "lucide-react";

import { segmentLabel } from "@/components/customers/badges";
import type { IconTone } from "@/components/ui/icon-tile";
import type { Customer } from "@/lib/data/types";

export interface NextAction {
  title: string;
  why: string;
  icon: LucideIcon;
  tone: IconTone;
  /** True when a campaign can act on it (consent is on file). */
  actionable: boolean;
}

function core(c: Customer): Omit<NextAction, "actionable"> {
  const pct = Math.round(c.churnProb * 100);
  const days = c.last_purchase_days;
  const seg = c.computedSegment;

  if (seg === "At_Risk" && c.riskBand === "High") {
    return {
      title: "Send win-back offer",
      why: `Churn risk is ${pct}% and the last purchase was ${days} days ago. A time-limited discount or bonus points can bring them back.`,
      icon: Gift,
      tone: "danger",
    };
  }
  if (seg === "Lost") {
    return {
      title: "Run a reactivation message",
      why: `No purchase for ${days} days. A low-cost "we miss you" message with a small points bonus is worth a try.`,
      icon: RefreshCw,
      tone: "warning",
    };
  }
  if (c.riskBand === "High") {
    return {
      title: "Reach out personally",
      why: `A ${segmentLabel(seg)} customer with a ${pct}% churn risk. A personal check-in or an early-access perk protects the relationship.`,
      icon: UserRound,
      tone: "danger",
    };
  }
  if (seg === "At_Risk") {
    return {
      title: "Send a gentle reminder",
      why: "Purchases are slowing down. New arrivals or a points reminder keeps them active before risk rises.",
      icon: Send,
      tone: "warning",
    };
  }
  if (seg === "Champion") {
    return {
      title: "Reward with VIP perks",
      why: "A top customer. Early access or a bonus-points multiplier keeps them engaged and talking about the store.",
      icon: Star,
      tone: "success",
    };
  }
  if (seg === "Loyal") {
    return {
      title: "Offer a points multiplier",
      why: "Buys steadily. A bonus-points offer or a bundle can nudge them towards Champion.",
      icon: Sparkles,
      tone: "primary",
    };
  }
  return {
    title: "Send a welcome offer",
    why: "A recent buyer. A small second-purchase incentive helps turn a first order into a habit.",
    icon: Gift,
    tone: "primary",
  };
}

/** Rule-based next best action from segment + churn risk + consent. Consent always comes first. */
export function nextAction(c: Customer): NextAction {
  const base = core(c);
  if (!c.consent) {
    return {
      title: "Ask for marketing consent first",
      why: `No consent on file, so campaigns cannot reach this customer. Once they agree: ${base.title.toLowerCase()}.`,
      icon: ShieldOff,
      tone: "neutral",
      actionable: false,
    };
  }
  return { ...base, actionable: true };
}

import { LOYALTY_TIERS, type LoyaltyTier } from "@/lib/data/types";

/** Programme rules shown on the Loyalty screen (also what the campaign points maths assumes). */
export const EARN_RUPEES_PER_POINT = 100; // 1 point per ₹100 spent
export const POINT_VALUE_INR = 0.25; // redemption value of one point
/** "Close to next tier" means this many points or fewer short of the next tier. */
export const NEAR_TIER_WINDOW = 500;
/** Bonus points a nudge gives. */
export const NUDGE_BONUS = 100;

export const TIER_BENEFITS: Record<LoyaltyTier, string> = {
  Bronze: "Earn 1 point per ₹100 and get a birthday-month offer.",
  Silver: "Early access to sales and 5% off every fifth order.",
  Gold: "Free delivery, 10% off every fifth order and priority support.",
  Platinum: "15% off every fifth order, VIP previews and a dedicated helper.",
};

/** Chart colour per tier (theme tokens only). */
export const TIER_COLOR: Record<LoyaltyTier, string> = {
  Bronze: "var(--chart-8)",
  Silver: "var(--chart-2)",
  Gold: "var(--chart-4)",
  Platinum: "var(--chart-1)",
};

export function nextTier(t: LoyaltyTier): LoyaltyTier | null {
  const i = LOYALTY_TIERS.indexOf(t);
  return LOYALTY_TIERS[i + 1] ?? null;
}

export const pointsToRupees = (points: number) => points * POINT_VALUE_INR;

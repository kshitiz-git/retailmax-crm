/**
 * Motion bible — the single source of truth for every duration and easing
 * in RetailMax CRM. No ad-hoc timings anywhere else in the codebase.
 */

export const D = {
  micro: 0.12,
  fast: 0.18,
  base: 0.26,
  slow: 0.42,
  chart: 0.85,
} as const;

export const E = {
  out: [0.22, 1, 0.36, 1],
  inOut: [0.65, 0, 0.35, 1],
  in: [0.4, 0, 1, 1],
  spring: { type: "spring", stiffness: 380, damping: 32, mass: 0.7 },
} as const;

export const STAGGER = 0.04;

export const EASE_CSS = "cubic-bezier(0.22, 1, 0.36, 1)";

/** Standard page/section entrance. */
export const enter = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: D.base, ease: E.out },
} as const;

export const staggerParent = (stagger = STAGGER, delayChildren = 0) => ({
  initial: {},
  animate: {
    transition: { staggerChildren: stagger, delayChildren },
  },
});

export const staggerChild = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: D.base, ease: E.out },
  },
} as const;

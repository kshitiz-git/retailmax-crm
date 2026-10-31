import * as React from "react";
import { motion, useInView, useMotionValue, useSpring } from "motion/react";

import { D, E } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/hooks/use-motion-prefs";

export type NumberTickerProps = {
  value: number;
  format?: (value: number) => string;
  className?: string;
  /** Count up from 0 on mount / on value change. */
  animate?: boolean;
};

/**
 * The single count-up primitive. Never hand-roll a counter anywhere else.
 */
export function NumberTicker({ value, format, className, animate = true }: NumberTickerProps) {
  const reduced = usePrefersReducedMotion();
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "0px 0px -40px 0px" });
  const [display, setDisplay] = React.useState(reduced || !animate ? value : 0);

  React.useEffect(() => {
    if (reduced || !animate || !inView) {
      setDisplay(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const duration = D.chart * 1000;
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setDisplay(from + (value - from) * ease(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, reduced, animate, inView]);

  return (
    <span ref={ref} className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {format ? format(display) : Math.round(display).toLocaleString("en-IN")}
    </span>
  );
}

/**
 * A live value that rolls vertically when it changes, instead of jumping.
 */
export function RollingNumber({ value, className }: { value: number; className?: string }) {
  const reduced = usePrefersReducedMotion();
  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums", display: "inline-block", overflow: "hidden" }}>
      <motion.span
        key={value}
        initial={reduced ? false : { y: "-100%", opacity: 0 }}
        animate={{ y: "0%", opacity: 1 }}
        transition={{ duration: D.base, ease: E.out }}
        style={{ display: "inline-block" }}
      >
        {value.toLocaleString("en-IN")}
      </motion.span>
    </span>
  );
}

/** Spring-tracked value used by gauges. */
export function useSpringValue(target: number) {
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 90, damping: 20 });
  React.useEffect(() => {
    mv.set(target);
  }, [mv, target]);
  return spring;
}

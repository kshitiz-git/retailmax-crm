import * as React from "react";
import { motion } from "motion/react";

import { cn } from "@/lib/utils";
import { D, E, STAGGER } from "@/lib/motion";
import { usePrefersReducedMotion } from "@/hooks/use-motion-prefs";

/**
 * The one card language for the whole app: white surface, hairline border,
 * generous radius, soft shadow, quiet 1px lift on hover. No spotlight, no glow.
 */
export const SpotlightCard = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { as?: "div" | "li" | "section" }
>(function SpotlightCard({ className, children, as = "div", ...props }, forwardedRef) {
  const Comp = as as React.ElementType;

  return (
    <Comp ref={forwardedRef} className={cn("soft-card soft-card-hover", className)} {...props}>
      {children}
    </Comp>
  );
});


/** Word-by-word blur-to-sharp reveal for page titles. */
export function BlurReveal({
  text,
  className,
  as: Tag = "h1",
}: {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "p";
}) {
  const reduced = usePrefersReducedMotion();
  const words = text.split(" ");

  if (reduced) return <Tag className={className}>{text}</Tag>;

  return (
    <Tag className={className}>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          initial={{ filter: "blur(8px)", opacity: 0, y: 8 }}
          animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
          transition={{ duration: D.slow, ease: E.out, delay: i * 0.045 }}
          style={{ display: "inline-block", whiteSpace: "pre" }}
        >
          {word}
          {i < words.length - 1 ? " " : ""}
        </motion.span>
      ))}
    </Tag>
  );
}

/** Staggered entrance wrapper for a page or a section body. */
export function Stagger({
  children,
  className,
  delay = 0,
  stagger = STAGGER,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const reduced = usePrefersReducedMotion();
  if (reduced) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  );
}

/** A single staggered child. */
export function StaggerItem({
  children,
  className,
  animate = true,
}: {
  children: React.ReactNode;
  className?: string;
  animate?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  if (reduced || !animate) return <div className={className}>{children}</div>;

  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
        show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: D.slow, ease: E.out } },
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * A calm live indicator. It breathes; it does not glow. Deliberately quiet so
 * a live badge never becomes the loudest thing on the screen.
 */
export function LiveDot({ className, size = 6 }: { className?: string; size?: number }) {
  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span className="live-breathe absolute inset-0 rounded-full bg-chart-3" />
      <span className="absolute inset-0 rounded-full bg-chart-3/40" />
    </span>
  );
}

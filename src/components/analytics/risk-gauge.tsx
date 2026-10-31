import { riskBand } from "@/lib/ml/churn";
import { RiskChip } from "./bits";
import { RISK_COLOR } from "./meta";

const R = 54;
const CIRC = Math.PI * R;

/** Half-circle gauge 0-100%. Colour follows the risk band; the tick marks the model's decision threshold. */
export function RiskGauge({ value, threshold }: { value: number; threshold: number }) {
  const band = riskBand(value);
  const v = Math.min(1, Math.max(0, value));
  // Point on the arc at fraction t: arc runs left (t = 0) to right (t = 1) over the top.
  const at = (t: number, radius: number) => ({
    x: 70 - radius * Math.cos(Math.PI * t),
    y: 70 - radius * Math.sin(Math.PI * t),
  });
  const a = at(threshold, R - 11);
  const b = at(threshold, R + 11);

  return (
    <div className="mx-auto w-full max-w-[260px]">
      <div className="relative">
      <svg viewBox="0 0 140 80" className="w-full" role="img" aria-label={`Churn probability ${(v * 100).toFixed(1)} percent, ${band} risk`}>
        <path d="M16 70 A54 54 0 0 1 124 70" fill="none" stroke="var(--surface-3)" strokeWidth="12" strokeLinecap="round" />
        <path
          d="M16 70 A54 54 0 0 1 124 70"
          fill="none"
          stroke={RISK_COLOR[band]}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - v)}
          style={{ transition: "stroke-dashoffset 280ms cubic-bezier(0.22, 1, 0.36, 1), stroke 280ms" }}
        />
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--text)" strokeWidth="1.6" strokeLinecap="round" />
        <text x="16" y="79" textAnchor="middle" className="fill-muted-foreground text-[6px]">
          0%
        </text>
        <text x="124" y="79" textAnchor="middle" className="fill-muted-foreground text-[6px]">
          100%
        </text>
      </svg>
      <div className="absolute inset-x-0 bottom-4 flex flex-col items-center">
        <p className="metric text-[30px]">{(v * 100).toFixed(1)}%</p>
        <RiskChip band={band} className="mt-1.5" />
      </div>
      </div>
      <p className="mt-2 text-center text-[10.5px] text-muted-foreground">
        Tick = decision threshold ({Math.round(threshold * 100)}%)
      </p>
    </div>
  );
}

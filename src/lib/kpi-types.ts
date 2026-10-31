export type Delta = { value: number; direction: "up" | "down" };

export type PulseTile = {
  key: string;
  label: string;
  value: number;
  format: "number" | "currency" | "hours" | "percent";
  sub: string;
  delta: Delta;
  spark: number[];
  split?: { label: string; value: number; color: string }[];
};

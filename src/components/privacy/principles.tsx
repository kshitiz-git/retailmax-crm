import { FingerprintPattern, ScrollText, ShieldCheck, Target, UserX, type LucideIcon } from "lucide-react";

import { IconTile } from "@/components/ui/icon-tile";
import { formatNumber, formatPercent } from "@/lib/format";

interface Principle {
  icon: LucideIcon;
  title: string;
  text: string;
}

/** The five DPDP Act 2023 commitments the app is built around, with live numbers from the store. */
export function Principles({
  customers,
  consentRate,
  erased,
  logEntries,
}: {
  customers: number;
  consentRate: number;
  erased: number;
  logEntries: number;
}) {
  const items: Principle[] = [
    {
      icon: FingerprintPattern,
      title: "Anonymised IDs only",
      text: `${formatNumber(customers)} customers are stored as IDs such as C00042. No names, phone numbers or emails are kept.`,
    },
    {
      icon: ShieldCheck,
      title: "Consent before marketing",
      text: `${formatPercent(consentRate, 0)} of customers have opted in. Campaigns skip everyone else automatically.`,
    },
    {
      icon: Target,
      title: "Purpose limitation",
      text: "Data is used only for segmentation, churn scoring, campaigns and loyalty. Nothing else, nothing sold.",
    },
    {
      icon: UserX,
      title: "Right to erasure",
      text: `Any customer can be removed in one step, with their notes and points history. ${formatNumber(erased)} erased so far.`,
    },
    {
      icon: ScrollText,
      title: "Audit trail",
      text: `Consent changes, erasures, imports and campaigns are logged with a time. ${formatNumber(logEntries)} entries so far.`,
    },
  ];

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {items.map((p) => (
        <li key={p.title} className="rounded-[14px] bg-surface-2 p-4">
          <IconTile icon={p.icon} tone="primary" size="sm" />
          <h4 className="font-display mt-3 text-[13.5px] font-semibold tracking-tight">{p.title}</h4>
          <p className="mt-1.5 text-[12px] leading-relaxed text-text-2">{p.text}</p>
        </li>
      ))}
    </ul>
  );
}

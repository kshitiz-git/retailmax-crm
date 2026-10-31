import { Coins, Gift, TrendingUp } from "lucide-react";

import { IconTile } from "@/components/ui/icon-tile";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TIER_THRESHOLDS } from "@/lib/data/derive";
import { LOYALTY_TIERS, type LoyaltyTier } from "@/lib/data/types";
import { formatNumber } from "@/lib/format";
import { EARN_RUPEES_PER_POINT, POINT_VALUE_INR, TIER_BENEFITS } from "./rules";
import { TierBadge } from "./tier-badge";

function Rule({ icon, title, value, note }: { icon: typeof Coins; title: string; value: string; note: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[14px] bg-surface-2 p-3.5">
      <IconTile icon={icon} tone="primary" size="sm" />
      <div className="min-w-0">
        <p className="text-[10.5px] uppercase tracking-wide text-text-3">{title}</p>
        <p className="metric mt-1.5 text-[17px] text-foreground">{value}</p>
        <p className="mt-1 text-[11.5px] text-text-2">{note}</p>
      </div>
    </div>
  );
}

/** Programme rules: earn rate, redemption value and the tier ladder with live member counts. */
export function ProgrammeRules({ members }: { members: Record<LoyaltyTier, number> }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Rule
          icon={Coins}
          title="Earn"
          value={`1 point per ₹${EARN_RUPEES_PER_POINT}`}
          note="On every rupee spent, rounded to whole points."
        />
        <Rule
          icon={Gift}
          title="Redeem"
          value={`₹${POINT_VALUE_INR.toFixed(2)} per point`}
          note={`${EARN_RUPEES_PER_POINT} points are worth ₹${formatNumber(EARN_RUPEES_PER_POINT * POINT_VALUE_INR)}.`}
        />
        <Rule
          icon={TrendingUp}
          title="Tier up"
          value="By points balance"
          note="A customer moves up as soon as the balance reaches the next tier."
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tier</TableHead>
            <TableHead className="text-right">From</TableHead>
            <TableHead className="min-w-56">Benefits</TableHead>
            <TableHead className="text-right">Members</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {LOYALTY_TIERS.map((t) => (
            <TableRow key={t}>
              <TableCell>
                <TierBadge tier={t} />
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(TIER_THRESHOLDS[t])} pts</TableCell>
              <TableCell className="whitespace-normal text-[12.5px] text-text-2">{TIER_BENEFITS[t]}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{formatNumber(members[t])}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

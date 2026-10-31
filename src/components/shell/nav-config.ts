import {
  LayoutDashboard,
  Users,
  PieChart,
  ShieldAlert,
  Megaphone,
  Gift,
  Filter,
  Database,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV: Array<{ group: string; items: NavItem[] }> = [
  {
    group: "Overview",
    items: [
      { to: "/", label: "Dashboard", icon: LayoutDashboard },
      { to: "/funnel", label: "Sales Funnel", icon: Filter },
    ],
  },
  {
    group: "Customers",
    items: [
      { to: "/customers", label: "Customers", icon: Users },
      { to: "/segments", label: "RFM Segments", icon: PieChart },
      { to: "/churn", label: "Churn Prediction", icon: ShieldAlert },
    ],
  },
  {
    group: "Engagement",
    items: [
      { to: "/campaigns", label: "Campaigns", icon: Megaphone },
      { to: "/loyalty", label: "Loyalty", icon: Gift },
    ],
  },
  {
    group: "Data & Privacy",
    items: [
      { to: "/data", label: "Data Import / Export", icon: Database },
      { to: "/privacy", label: "Privacy & Consent", icon: ShieldCheck },
    ],
  },
];

import * as React from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Menu, Search, ShoppingBag, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { useCRM } from "@/lib/store";
import { NAV } from "./nav-config";
import { ErrorBoundary } from "./error-boundary";

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-4 py-5">
      <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
        <ShoppingBag className="size-5" />
      </div>
      <div className="leading-tight">
        <p className="font-display text-[15px] font-semibold tracking-tight">RetailMax</p>
        <p className="text-[11px] text-muted-foreground">Customer Relationships</p>
      </div>
    </div>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-5 px-3 pb-6">
      {NAV.map((g) => (
        <div key={g.group}>
          <p className="px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-text-3">{g.group}</p>
          <ul className="flex flex-col gap-0.5">
            {g.items.map((it) => (
              <li key={it.to}>
                <NavLink
                  to={it.to}
                  end={it.to === "/"}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors",
                      isActive
                        ? "bg-primary-soft text-primary"
                        : "text-text-2 hover:bg-surface-2 hover:text-foreground",
                    )
                  }
                >
                  <it.icon className="size-4 shrink-0" />
                  {it.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function TopBar({ onMenu }: { onMenu: () => void }) {
  const { customers, byId, dataSource, resetDemo } = useCRM();
  const navigate = useNavigate();
  const [q, setQ] = React.useState("");
  const [miss, setMiss] = React.useState(false);
  const [confirmReset, setConfirmReset] = React.useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const id = q.trim().toUpperCase();
    if (!id) return;
    if (byId.has(id)) {
      setMiss(false);
      setQ("");
      navigate(`/customers/${id}`);
    } else {
      // Not an exact id: hand the text to the customer list as a search.
      setMiss(false);
      navigate(`/customers?q=${encodeURIComponent(q.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:px-6">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onMenu} aria-label="Open menu">
        <Menu className="size-5" />
      </Button>
      <form onSubmit={submit} className="relative w-full max-w-sm" role="search">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setMiss(false);
          }}
          placeholder="Find customer by ID, e.g. C00042"
          aria-label="Find customer"
          aria-invalid={miss}
          className="h-9 pl-8"
        />
      </form>
      <div className="ml-auto flex items-center gap-2">
        <Badge
          variant="outline"
          className="hidden sm:inline-flex"
          title={dataSource === "bundled" ? "Customer data loaded from dataset.csv" : "Customer data loaded from an imported CSV file"}
        >
          {formatNumber(customers.length)} customers{dataSource === "bundled" ? "" : " · imported"}
        </Badge>
        {confirmReset ? (
          <div className="flex items-center gap-1.5">
            <span className="hidden text-[12px] text-muted-foreground lg:inline">Undo all changes and reload the original data?</span>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                resetDemo();
                setConfirmReset(false);
              }}
            >
              Reset
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => setConfirmReset(true)} title="Undo all changes and reload the original customer data">
            <RotateCcw className="size-4" />
            <span className="hidden lg:inline">Reset data</span>
          </Button>
        )}
      </div>
    </header>
  );
}

export function AppShell() {
  const [open, setOpen] = React.useState(false);
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 overflow-y-auto border-r border-border bg-sidebar md:block">
        <Brand />
        <NavList />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Brand />
          <NavList onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="md:pl-60">
        <TopBar onMenu={() => setOpen(true)} />
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 md:px-6 md:py-8">
          <ErrorBoundary key={pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
        <footer className="px-4 pb-6 text-center text-[11px] text-muted-foreground md:px-6">
          RetailMax CRM · HCLTech Career Shaper project · anonymised customer IDs only (DPDP Act 2023)
        </footer>
      </div>
    </div>
  );
}

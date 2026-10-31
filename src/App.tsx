import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/shell/app-shell";
import { CRMProvider } from "@/lib/store";
import Dashboard from "@/pages/dashboard";
import Funnel from "@/pages/funnel";
import Customers from "@/pages/customers";
import CustomerDetail from "@/pages/customer-detail";
import Segments from "@/pages/segments";
import Churn from "@/pages/churn";
import Campaigns from "@/pages/campaigns";
import Loyalty from "@/pages/loyalty";
import DataPage from "@/pages/data";
import Privacy from "@/pages/privacy";
import NotFound from "@/pages/not-found";

// HashRouter: the app is a static build (GitHub Pages / any folder), so deep links must not need a server.
export function App() {
  return (
    <CRMProvider>
      <TooltipProvider delayDuration={150}>
        <HashRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="funnel" element={<Funnel />} />
              <Route path="customers" element={<Customers />} />
              <Route path="customers/:id" element={<CustomerDetail />} />
              <Route path="segments" element={<Segments />} />
              <Route path="churn" element={<Churn />} />
              <Route path="campaigns" element={<Campaigns />} />
              <Route path="loyalty" element={<Loyalty />} />
              <Route path="data" element={<DataPage />} />
              <Route path="privacy" element={<Privacy />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </HashRouter>
        <Toaster position="bottom-right" />
      </TooltipProvider>
    </CRMProvider>
  );
}

import * as React from "react";
import { Download, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConsentTable } from "@/components/privacy/consent-table";
import { Erasure } from "@/components/privacy/erasure";
import { Logs } from "@/components/privacy/logs";
import { Principles } from "@/components/privacy/principles";
import { consentRegisterCsv } from "@/components/privacy/register";
import { BarSeries, DonutChart } from "@/components/panels/charts";
import { Panel, PanelGrid } from "@/components/panels/panel";
import { PageHeader } from "@/components/shell/page-scaffold";
import { downloadText } from "@/lib/data/csv";
import { SEGMENTS } from "@/lib/data/types";
import { formatNumber, formatPercent } from "@/lib/format";
import { useCRM } from "@/lib/store";

const segLabel = (s: string) => s.replace("_", " ");
const CONSENTED = "Consented";
const NO_CONSENT = "No consent";

export default function Privacy() {
  const { customers, consentLog, audit, erased } = useCRM();

  const consent = React.useMemo(() => {
    const by: Record<string, { yes: number; no: number }> = {};
    for (const s of SEGMENTS) by[s] = { yes: 0, no: 0 };
    let yes = 0;
    for (const c of customers) {
      const b = by[c.computedSegment]!;
      if (c.consent) {
        yes++;
        b.yes++;
      } else b.no++;
    }
    return { by, yes, no: customers.length - yes };
  }, [customers]);

  const n = customers.length;
  const rate = n > 0 ? (consent.yes / n) * 100 : 0;
  const segRate = (s: string) => {
    const b = consent.by[s]!;
    return b.yes + b.no > 0 ? (b.yes / (b.yes + b.no)) * 100 : 0;
  };
  const populated = SEGMENTS.filter((s) => consent.by[s]!.yes + consent.by[s]!.no > 0);
  const best = populated.reduce((a, s) => (segRate(s) > segRate(a) ? s : a), populated[0] ?? SEGMENTS[0]);
  const worst = populated.reduce((a, s) => (segRate(s) < segRate(a) ? s : a), populated[0] ?? SEGMENTS[0]);

  const donut = [
    { key: CONSENTED, value: consent.yes, color: "var(--chart-1)" },
    { key: NO_CONSENT, value: consent.no, color: "var(--chart-2)" },
  ];
  const segData = SEGMENTS.map((s) => ({
    label: segLabel(s),
    [CONSENTED]: consent.by[s]!.yes,
    [NO_CONSENT]: consent.by[s]!.no,
  }));

  const exportRegister = () => {
    const csv = consentRegisterCsv(customers, consentLog, audit, erased);
    downloadText("consent-register.csv", csv);
    toast.success("Consent register exported", {
      description: `${formatNumber(n + erased.length)} rows in consent-register.csv`,
    });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Data & Privacy"
        title="Privacy & Consent"
        description="How this CRM follows the Digital Personal Data Protection Act 2023: consent first, anonymised IDs, and a record of every change."
        actions={
          <>
            <Badge variant="outline" className="gap-1.5 rounded-full border-transparent bg-success/12 px-3 py-1 text-[11.5px] text-success">
              <ShieldCheck className="size-3.5" aria-hidden />
              DPDP Act 2023
            </Badge>
            <Button variant="outline" onClick={exportRegister}>
              <Download className="size-4" />
              Export consent register
            </Button>
          </>
        }
      />

      <PanelGrid>
        <Panel span={3} title="Our privacy principles" subtitle="Built into how the app stores and uses customer data">
          <Principles customers={n} consentRate={rate} erased={erased.length} logEntries={consentLog.length + audit.length} />
        </Panel>

        <Panel
          title="Marketing consent"
          subtitle={`${formatNumber(n)} customers`}
          insight={`${formatNumber(consent.no)} customers have not opted in, so every campaign skips them.`}
        >
          <DonutChart data={donut} height={200} centerValue={formatPercent(rate, 0)} centerLabel="consented" />
        </Panel>

        <Panel
          span={2}
          title="Consent by segment"
          subtitle="Customers who opted in and who did not"
          insight={
            n > 0
              ? `${segLabel(best)} customers opt in most (${formatPercent(segRate(best), 0)}); ${segLabel(worst)} least (${formatPercent(segRate(worst), 0)}).`
              : undefined
          }
        >
          <BarSeries data={segData} keys={[CONSENTED, NO_CONSENT]} stacked height={230} />
        </Panel>

        <Panel
          span={3}
          title="Manage consent"
          subtitle="Grant or withdraw marketing consent. Every change is logged."
        >
          <ConsentTable />
        </Panel>

        <Panel
          span={2}
          title="Right to erasure"
          subtitle="Remove a customer completely when they ask"
          help="Erasure deletes the record, notes and points history. The consent log and audit log keep the anonymised ID as proof the request was handled."
        >
          <Erasure />
        </Panel>

        <Panel title="Erased IDs" subtitle={`${formatNumber(erased.length)} erasure requests handled`}>
          {erased.length === 0 ? (
            <p className="rounded-[14px] bg-surface-2 px-4 py-6 text-center text-[12.5px] text-text-2">
              No erasure requests yet.
            </p>
          ) : (
            <ul className="flex max-h-64 flex-wrap gap-1.5 overflow-y-auto" aria-label="Erased customer IDs">
              {[...erased].reverse().map((id) => (
                <li key={id}>
                  <Badge variant="outline" className="rounded-full font-mono text-[11.5px]">
                    {id}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel span={3} title="Logs" subtitle="Consent changes and system actions, newest first">
          <Logs />
        </Panel>
      </PanelGrid>
    </div>
  );
}

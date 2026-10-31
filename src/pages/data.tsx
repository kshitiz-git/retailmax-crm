import * as React from "react";
import { Database, FileDown, FileSpreadsheet, Sparkles, type LucideIcon } from "lucide-react";
import { toast } from "sonner";

import { ColumnsGuide, CsvUpload, SAMPLE_ROW } from "@/components/customers/data-import";
import { DataQuality } from "@/components/customers/data-quality";
import { PageHeader } from "@/components/shell/page-scaffold";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconTile } from "@/components/ui/icon-tile";
import { customersToCsv, downloadText, toCsv } from "@/lib/data/csv";
import { CSV_COLUMNS } from "@/lib/data/types";
import { formatNumber } from "@/lib/format";
import { useCRM } from "@/lib/store";

const ENRICHED_EXTRA = [
  "monetary",
  "r",
  "f",
  "m",
  "rfmScore",
  "computedSegment",
  "points",
  "tier",
  "consent",
  "churnProb",
  "riskBand",
] as const;

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="soft-card mt-5 p-5 sm:p-6">
      <h2 className="font-display text-[15px] font-semibold tracking-tight">{title}</h2>
      {description && <p className="mt-1 max-w-2xl text-[12.5px] text-text-3">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ExportCard({
  icon,
  title,
  description,
  meta,
  onClick,
  disabled,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  meta: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface-2/40 p-4">
      <div className="flex items-start gap-3">
        <IconTile icon={icon} tone="primary" />
        <div className="min-w-0">
          <h3 className="text-[14px] font-semibold">{title}</h3>
          <p className="mt-1 text-xs leading-relaxed text-text-2">{description}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11.5px] text-text-3">{meta}</span>
        <Button size="sm" variant="outline" onClick={onClick} disabled={disabled}>
          <FileDown /> Download CSV
        </Button>
      </div>
    </div>
  );
}

export default function DataPage() {
  const crm = useCRM();
  const n = crm.rows.length;

  const exportFull = () => {
    downloadText("retailmax-dataset.csv", customersToCsv(crm.rows));
    toast.success(`Exported ${formatNumber(n)} rows`, { description: "retailmax-dataset.csv" });
  };

  const exportEnriched = () => {
    const rows = crm.customers.map((c) => [
      ...CSV_COLUMNS.map((k) => c[k]),
      Number(c.monetary.toFixed(2)),
      c.r,
      c.f,
      c.m,
      c.rfmScore,
      c.computedSegment,
      c.points,
      c.tier,
      c.consent ? "yes" : "no",
      c.churnProb.toFixed(4),
      c.riskBand,
    ]);
    downloadText("retailmax-enriched.csv", toCsv([...CSV_COLUMNS, ...ENRICHED_EXTRA], rows));
    toast.success(`Exported ${formatNumber(rows.length)} enriched rows`, { description: "retailmax-enriched.csv" });
  };

  const downloadTemplate = () => {
    downloadText("retailmax-template.csv", toCsv(CSV_COLUMNS, [CSV_COLUMNS.map((c) => SAMPLE_ROW[c])]));
    toast.success("Template downloaded", { description: "retailmax-template.csv" });
  };

  return (
    <div className="pb-10">
      <PageHeader
        eyebrow="Data"
        title="Import and export"
        description="Bring your own customer file in, or take the CRM's data out. Everything stays in this browser."
        actions={
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <FileSpreadsheet /> Download template
          </Button>
        }
      />

      <div className="soft-card flex flex-wrap items-center gap-4 p-4 sm:p-5">
        <IconTile icon={Database} tone="primary" size="lg" />
        <div className="min-w-0 flex-1">
          <p className="text-micro text-text-2">Current data source</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-[15px] font-semibold">
            {crm.dataSource === "bundled" ? "Bundled dataset (dataset.csv)" : "Imported CSV"}
            <Badge variant="outline" className="border-transparent bg-primary/10 text-[11px] text-foreground">
              {crm.dataSource === "bundled" ? "Original file" : "Your upload"}
            </Badge>
          </p>
        </div>
        <div className="text-right">
          <p className="metric text-[28px]">{formatNumber(n)}</p>
          <p className="mt-1 text-[11.5px] text-text-3">
            customers loaded{crm.erased.length > 0 && ` · ${formatNumber(crm.erased.length)} erased`}
          </p>
        </div>
      </div>

      <Section
        title="Import customers"
        description="Upload a CSV with the columns below. Check the preview, then merge it into the current data or replace it."
      >
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="min-w-0">
            <h3 className="mb-3 text-[13px] font-semibold">Expected columns</h3>
            <ColumnsGuide />
          </div>
          <div className="min-w-0">
            <h3 className="mb-3 text-[13px] font-semibold">Upload a file</h3>
            <CsvUpload />
          </div>
        </div>
      </Section>

      <Section title="Export" description="Download the data you see in the CRM. Files open in Excel and Google Sheets.">
        <div className="grid gap-4 md:grid-cols-2">
          <ExportCard
            icon={FileDown}
            title="Full dataset"
            description="The original nine columns for every customer, in the same format you can import again."
            meta={`${formatNumber(n)} rows · ${CSV_COLUMNS.length} columns`}
            onClick={exportFull}
            disabled={n === 0}
          />
          <ExportCard
            icon={Sparkles}
            title="Enriched dataset"
            description="Adds lifetime value, R/F/M scores, computed segment, points, tier, consent, churn probability and risk band."
            meta={`${formatNumber(crm.customers.length)} rows · ${CSV_COLUMNS.length + ENRICHED_EXTRA.length} columns`}
            onClick={exportEnriched}
            disabled={crm.customers.length === 0}
          />
        </div>
      </Section>

      <Section title="Data quality" description="A quick health check of the data currently loaded.">
        <DataQuality customers={crm.customers} />
      </Section>
    </div>
  );
}

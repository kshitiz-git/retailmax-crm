import * as React from "react";
import { useNavigate } from "react-router-dom";
import { CircleAlert, FileSpreadsheet, FileUp, Loader, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { parseCustomers, type RowError } from "@/lib/data/csv";
import { AGE_GROUPS, CSV_COLUMNS, REGIONS, SEGMENTS, type CustomerRow } from "@/lib/data/types";
import { formatNumber } from "@/lib/format";
import { useCRM } from "@/lib/store";
import { cn } from "@/lib/utils";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ERRORS_SHOWN = 50;
const PREVIEW_ROWS = 10;

/** One valid example row, in dataset column order. */
export const SAMPLE_ROW: Record<(typeof CSV_COLUMNS)[number], string | number> = {
  customer_id: "C10001",
  age_group: "26-35",
  region: "West",
  purchase_freq: 12,
  avg_order_value: 4500,
  last_purchase_days: 30,
  loyalty_points: 2400,
  churn_flag: 0,
  rfm_segment: "Loyal",
};

const COLUMN_HELP: Record<(typeof CSV_COLUMNS)[number], { kind: string; rule: string }> = {
  customer_id: { kind: "Text", rule: "Unique per row, e.g. C00042" },
  age_group: { kind: "Choice", rule: AGE_GROUPS.join(", ") },
  region: { kind: "Choice", rule: REGIONS.join(", ") },
  purchase_freq: { kind: "Number", rule: "Orders to date, 0 or more" },
  avg_order_value: { kind: "Number", rule: "Rupees per order, 0 or more" },
  last_purchase_days: { kind: "Number", rule: "Days since last order, 0 to 3650" },
  loyalty_points: { kind: "Number", rule: "Points balance, 0 or more" },
  churn_flag: { kind: "Number", rule: "1 = churned, 0 = still active" },
  rfm_segment: { kind: "Choice", rule: SEGMENTS.join(", ") },
};

/* ------------------------------ Column guide ------------------------------ */

export function ColumnsGuide() {
  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-border">
        <Table className="min-w-[560px] text-[13px]">
          <TableHeader className="bg-surface-2/60">
            <TableRow className="hover:bg-transparent">
              <TableHead className="px-3 text-xs">Column</TableHead>
              <TableHead className="px-3 text-xs">Type</TableHead>
              <TableHead className="px-3 text-xs">Allowed values</TableHead>
              <TableHead className="px-3 text-xs">Sample</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {CSV_COLUMNS.map((col) => (
              <TableRow key={col}>
                <TableCell className="px-3 py-2 font-mono text-xs font-medium">{col}</TableCell>
                <TableCell className="px-3 py-2 text-text-2">{COLUMN_HELP[col].kind}</TableCell>
                <TableCell className="px-3 py-2 text-text-2">{COLUMN_HELP[col].rule}</TableCell>
                <TableCell className="px-3 py-2 font-mono text-xs">{SAMPLE_ROW[col]}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="mt-3 text-xs font-medium text-text-2">Sample file</p>
      <pre className="mt-1.5 overflow-x-auto rounded-lg bg-surface-2 p-3 font-mono text-[11.5px] leading-relaxed text-text-2">
        {CSV_COLUMNS.join(",")}
        {"\n"}
        {CSV_COLUMNS.map((c) => SAMPLE_ROW[c]).join(",")}
      </pre>
      <p className="mt-3 text-xs leading-relaxed text-text-3">
        Column order does not matter and extra columns are ignored. A row with a problem is skipped and listed below, never
        silently changed.
      </p>
    </div>
  );
}

/* ------------------------------ Upload ------------------------------ */

interface Staged {
  fileName: string;
  size: number;
  rows: CustomerRow[];
  errors: RowError[];
}

const mb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export function CsvUpload() {
  const crm = useCRM();
  const navigate = useNavigate();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [staged, setStaged] = React.useState<Staged | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [dragging, setDragging] = React.useState(false);
  const [confirmReplace, setConfirmReplace] = React.useState(false);

  const readFile = (file: File) => {
    setFileError(null);
    setStaged(null);
    if (!/\.csv$/i.test(file.name)) {
      setFileError(`"${file.name}" is not a .csv file. Export your sheet as CSV (comma separated) and try again.`);
      return;
    }
    if (file.size === 0) {
      setFileError(`"${file.name}" is empty.`);
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setFileError(`"${file.name}" is ${mb(file.size)}. The limit is ${mb(MAX_FILE_BYTES)}; split the file and import it in parts.`);
      return;
    }
    setBusy(true);
    const reader = new FileReader();
    reader.onerror = () => {
      setBusy(false);
      setFileError(`Could not read "${file.name}". Check that the file is not open elsewhere and try again.`);
    };
    reader.onload = () => {
      try {
        const { rows, errors } = parseCustomers(String(reader.result ?? ""));
        setStaged({ fileName: file.name, size: file.size, rows, errors });
      } catch {
        setFileError(`"${file.name}" could not be parsed. Make sure it is a plain comma-separated CSV.`);
      } finally {
        setBusy(false);
      }
    };
    reader.readAsText(file);
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = ""; // lets the same file be picked again after a fix
    if (f) readFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = e.dataTransfer.files;
    if (!files.length) return;
    readFile(files[0]!);
    if (files.length > 1) toast.info("Only the first file was used", { description: "Import one CSV at a time." });
  };

  const counts = React.useMemo(() => {
    if (!staged) return { fresh: 0, updated: 0 };
    let fresh = 0;
    for (const r of staged.rows) if (!crm.byId.has(r.customer_id)) fresh++;
    return { fresh, updated: staged.rows.length - fresh };
  }, [staged, crm.byId]);

  const doImport = (mode: "merge" | "replace") => {
    if (!staged || staged.rows.length === 0) return;
    const n = staged.rows.length;
    crm.importRows(staged.rows, mode);
    setStaged(null);
    setConfirmReplace(false);
    toast.success(mode === "merge" ? `Merged ${formatNumber(n)} customers` : `Replaced data with ${formatNumber(n)} customers`, {
      description: "Segments, churn scores and every page now use the new data.",
      action: { label: "View customers", onClick: () => navigate("/customers") },
    });
  };

  const shownErrors = staged?.errors.slice(0, MAX_ERRORS_SHOWN) ?? [];
  const hiddenErrors = (staged?.errors.length ?? 0) - shownErrors.length;
  const canImport = !!staged && staged.rows.length > 0;

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-9 text-center transition-colors",
          dragging ? "border-primary bg-primary-soft" : "border-border bg-surface-2/40",
        )}
      >
        <span aria-hidden className="mb-3 flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
          {busy ? <Loader className="size-5 animate-spin" /> : <FileUp className="size-5" />}
        </span>
        <p className="text-[14px] font-medium">{busy ? "Reading file..." : "Drop a CSV file here"}</p>
        <p className="mt-1 text-xs text-text-3">.csv only, up to {mb(MAX_FILE_BYTES)}</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={onPick}
          aria-label="Choose a CSV file to import"
          tabIndex={-1}
        />
        <Button variant="outline" size="sm" className="mt-4" disabled={busy} onClick={() => inputRef.current?.click()}>
          <FileSpreadsheet /> Choose file
        </Button>
      </div>

      <div aria-live="polite">
        {fileError && (
          <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-lg bg-danger/10 px-3.5 py-3 text-[13px]">
            <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
            <p className="min-w-0 flex-1">{fileError}</p>
            <button
              type="button"
              onClick={() => setFileError(null)}
              aria-label="Dismiss message"
              className="cursor-pointer rounded-sm text-text-3 hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {staged && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{staged.fileName}</p>
                <p className="text-xs text-text-3">{mb(staged.size)}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStaged(null)}>
                <X /> Remove file
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Count label="Valid rows" value={staged.rows.length} tone={staged.rows.length ? "good" : "bad"} />
              <Count label="Rows with errors" value={staged.errors.length} tone={staged.errors.length ? "warn" : "good"} />
              <Count label="New customers" value={counts.fresh} />
              <Count label="Update existing" value={counts.updated} />
            </div>

            {staged.rows.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium text-text-2">
                  Preview · first {Math.min(PREVIEW_ROWS, staged.rows.length)} of {formatNumber(staged.rows.length)} valid rows
                </p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table className="min-w-[720px] text-xs">
                    <TableHeader className="bg-surface-2/60">
                      <TableRow className="hover:bg-transparent">
                        {CSV_COLUMNS.map((col) => (
                          <TableHead key={col} className="h-9 px-3 font-mono text-[11px]">
                            {col}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {staged.rows.slice(0, PREVIEW_ROWS).map((r) => (
                        <TableRow key={r.customer_id}>
                          {CSV_COLUMNS.map((col) => (
                            <TableCell key={col} className="px-3 py-1.5 tnum">
                              {r[col]}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {staged.errors.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-2">
                  <TriangleAlert className="size-3.5 text-warning" />
                  {formatNumber(staged.errors.length)} row{staged.errors.length > 1 ? "s" : ""} skipped
                </p>
                <ul className="max-h-52 divide-y divide-border overflow-y-auto rounded-lg border border-border bg-surface-2/40 text-xs">
                  {shownErrors.map((er, i) => (
                    <li key={i} className="flex gap-3 px-3 py-2">
                      <span className="w-14 shrink-0 font-mono text-text-3">Line {er.line}</span>
                      <span className="min-w-0 break-words">{er.message}</span>
                    </li>
                  ))}
                  {hiddenErrors > 0 && (
                    <li className="px-3 py-2 text-text-3">...and {formatNumber(hiddenErrors)} more not shown</li>
                  )}
                </ul>
              </div>
            )}

            {!canImport && (
              <p className="text-[13px] text-text-2">No valid rows to import. Fix the problems above and choose the file again.</p>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button disabled={!canImport} onClick={() => doImport("merge")}>
                Merge into current data
              </Button>
              <Button variant="outline" disabled={!canImport} onClick={() => setConfirmReplace(true)}>
                Replace current data
              </Button>
              <p className="basis-full text-xs text-text-3 sm:basis-auto sm:pl-1">
                Merge adds new IDs and updates matching ones. Replace swaps the whole customer base.
              </p>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace all current data?</AlertDialogTitle>
            <AlertDialogDescription>
              The {formatNumber(crm.rows.length)} customers now loaded will be swapped for the{" "}
              {formatNumber(staged?.rows.length ?? 0)} rows in this file. You can restore the bundled dataset any time from
              Reset demo in the top bar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current data</AlertDialogCancel>
            <AlertDialogAction onClick={() => doImport("replace")}>Replace data</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Count({ label, value, tone }: { label: string; value: number; tone?: "good" | "warn" | "bad" }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2.5">
      <p className="text-[11px] text-text-3">{label}</p>
      <p
        className={cn(
          "metric mt-1.5 text-[20px]",
          tone === "good" && "text-success",
          tone === "warn" && "text-warning",
          tone === "bad" && "text-danger",
        )}
      >
        {formatNumber(value)}
      </p>
    </div>
  );
}

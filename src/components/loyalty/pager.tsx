import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/format";

/** Client-side paging: page index is clamped, so a shrinking list never strands the user on an empty page. */
export function usePaged<T>(items: readonly T[], size: number) {
  const [page, setPage] = React.useState(0);
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const safe = Math.min(page, pageCount - 1);
  const slice = React.useMemo(() => items.slice(safe * size, safe * size + size), [items, safe, size]);
  return { page: safe, setPage, pageCount, slice, total: items.length, size };
}

export function Pager({
  page,
  pageCount,
  total,
  size,
  onPage,
  label = "rows",
}: {
  page: number;
  pageCount: number;
  total: number;
  size: number;
  onPage: (p: number) => void;
  label?: string;
}) {
  if (total === 0) return null;
  const from = page * size + 1;
  const to = Math.min(total, page * size + size);
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-[12px] text-text-2">
      <p className="tabular-nums">
        {formatNumber(from)}-{formatNumber(to)} of {formatNumber(total)} {label}
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>
        <span className="px-1 tabular-nums">
          Page {page + 1} of {pageCount}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= pageCount - 1}
          onClick={() => onPage(page + 1)}
          aria-label="Next page"
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

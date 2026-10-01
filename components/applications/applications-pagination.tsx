import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PAGE_SIZES, serializeApplicationQuery, type ApplicationQuery } from "@/lib/applications/query";

export function ApplicationsPagination({
  query,
  total,
  pageCount,
}: {
  query: ApplicationQuery;
  total: number;
  pageCount: number;
}) {
  const page = Math.min(query.page, pageCount);
  const start = total === 0 ? 0 : (page - 1) * query.pageSize + 1;
  const end = Math.min(page * query.pageSize, total);
  const href = (p: number, pageSize = query.pageSize) => `?${serializeApplicationQuery({ ...query, page: p, pageSize })}`;

  return (
    <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
      <p>
        Showing <span className="font-medium text-foreground">{start}</span>–
        <span className="font-medium text-foreground">{end}</span> of{" "}
        <span className="font-medium text-foreground">{total}</span>
      </p>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <span>Rows</span>
          {PAGE_SIZES.map((size) => (
            <Button key={size} asChild variant={size === query.pageSize ? "secondary" : "ghost"} size="sm">
              <Link href={href(1, size)} scroll={false}>
                {size}
              </Link>
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button asChild={page > 1} variant="outline" size="icon-sm" disabled={page <= 1} aria-label="Previous page">
            {page > 1 ? (
              <Link href={href(page - 1)} scroll={false}>
                <ChevronLeft />
              </Link>
            ) : (
              <ChevronLeft />
            )}
          </Button>
          <span className="px-2">
            Page {page} of {pageCount}
          </span>
          <Button asChild={page < pageCount} variant="outline" size="icon-sm" disabled={page >= pageCount} aria-label="Next page">
            {page < pageCount ? (
              <Link href={href(page + 1)} scroll={false}>
                <ChevronRight />
              </Link>
            ) : (
              <ChevronRight />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

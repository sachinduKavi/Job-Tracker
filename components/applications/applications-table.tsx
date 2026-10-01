import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { RowActions } from "@/components/applications/row-actions";
import { EmailStatusBadge, StatusBadge } from "@/components/applications/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ApplicationListItem } from "@/lib/applications/service";
import { serializeApplicationQuery, type ApplicationQuery, type SortField } from "@/lib/applications/query";
import { getSourceLabel } from "@/lib/applications/source";
import { formatDate } from "@/lib/format";

/** Server-rendered applications table. Sorting links are plain URLs (?sort=&order=). */
function SortHeader({ field, label, query }: { field: SortField; label: string; query: ApplicationQuery }) {
  const active = query.sort === field;
  const nextOrder = active && query.order === "asc" ? "desc" : "asc";
  const params = serializeApplicationQuery({ ...query, sort: field, order: active ? nextOrder : field === "dateApplied" ? "desc" : "asc", page: 1 });
  const Icon = !active ? ArrowUpDown : query.order === "asc" ? ArrowUp : ArrowDown;
  return (
    <Link
      href={`?${params}`}
      scroll={false}
      className="inline-flex items-center gap-1 hover:text-foreground"
      aria-label={`Sort by ${label}`}
    >
      {label}
      <Icon className={active ? "size-3.5 text-foreground" : "size-3.5 opacity-50"} />
    </Link>
  );
}

export function ApplicationsTable({ items, query }: { items: ApplicationListItem[]; query: ApplicationQuery }) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            <TableHead className="w-28">
              <SortHeader field="applicationId" label="ID" query={query} />
            </TableHead>
            <TableHead>
              <SortHeader field="dateApplied" label="Date Applied" query={query} />
            </TableHead>
            <TableHead>
              <SortHeader field="company" label="Company" query={query} />
            </TableHead>
            <TableHead>
              <SortHeader field="position" label="Position" query={query} />
            </TableHead>
            <TableHead className="hidden xl:table-cell">Tech Stack</TableHead>
            <TableHead className="hidden md:table-cell">Location</TableHead>
            <TableHead>
              <SortHeader field="status" label="Status" query={query} />
            </TableHead>
            <TableHead className="hidden lg:table-cell">Source</TableHead>
            <TableHead className="w-12">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((app) => (
            <TableRow key={app.id} data-testid="application-row">
              <TableCell className="font-mono text-xs">
                <Link href={`/applications/${app.id}`} className="font-medium text-primary hover:underline">
                  {app.applicationId}
                </Link>
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(app.dateApplied)}</TableCell>
              <TableCell className="font-medium">{app.company}</TableCell>
              <TableCell className="max-w-64 truncate" title={app.position}>
                {app.position}
              </TableCell>
              <TableCell className="hidden max-w-56 xl:table-cell">
                <div className="flex flex-wrap gap-1">
                  {app.techStack.slice(0, 4).map((t) => (
                    <span key={t.name} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {t.name}
                    </span>
                  ))}
                  {app.techStack.length > 4 ? (
                    <span className="text-xs text-muted-foreground">+{app.techStack.length - 4}</span>
                  ) : null}
                </div>
              </TableCell>
              <TableCell className="hidden text-muted-foreground md:table-cell">{app.location ?? "—"}</TableCell>
              <TableCell>
                <div className="flex flex-col items-start gap-1">
                  <StatusBadge status={app.status} />
                  {app.emails[0] ? <EmailStatusBadge status={app.emails[0].emailStatus} className="opacity-80" /> : null}
                </div>
              </TableCell>
              <TableCell className="hidden text-muted-foreground lg:table-cell">{getSourceLabel(app.source)}</TableCell>
              <TableCell>
                <RowActions
                  application={{
                    id: app.id,
                    applicationId: app.applicationId,
                    company: app.company,
                    position: app.position,
                    status: app.status,
                  }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

import type { Prisma } from "@/lib/generated/prisma/client";
import type { ApplicationSource, ApplicationStatus } from "@/lib/generated/prisma/enums";
import { isApplicationSource } from "@/lib/applications/source";
import { isApplicationStatus } from "@/lib/applications/status";
import { parseDateOnly } from "@/lib/validation/common";

/**
 * Dashboard search / filter / sort / pagination state.
 *
 * The state lives in URL query parameters so views are bookmarkable and shareable,
 * and so the page can be rendered entirely on the server. This module is pure: it
 * converts URL params ⇄ a typed query ⇄ a Prisma `where`/`orderBy`.
 * See docs/features/applications.md#search-filtering-and-sorting.
 */

export const SORT_FIELDS = ["dateApplied", "company", "position", "status", "applicationId", "updatedAt"] as const;
export type SortField = (typeof SORT_FIELDS)[number];
export type SortOrder = "asc" | "desc";
export const PAGE_SIZES = [10, 20, 50, 100] as const;

export interface ApplicationQuery {
  q: string;
  status: ApplicationStatus[];
  source: ApplicationSource[];
  company: string;
  position: string;
  location: string;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  sort: SortField;
  order: SortOrder;
  page: number;
  pageSize: number;
}

export const DEFAULT_QUERY: ApplicationQuery = {
  q: "",
  status: [],
  source: [],
  company: "",
  position: "",
  location: "",
  from: "",
  to: "",
  sort: "dateApplied",
  order: "desc",
  page: 1,
  pageSize: 20,
};

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function many(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.flatMap((v) => v.split(",")).map((v) => v.trim()).filter(Boolean);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseApplicationQuery(params: RawParams): ApplicationQuery {
  const sort = first(params.sort);
  const order = first(params.order);
  const page = Number.parseInt(first(params.page), 10);
  const pageSize = Number.parseInt(first(params.pageSize), 10);
  const from = first(params.from);
  const to = first(params.to);

  return {
    q: first(params.q).slice(0, 200),
    status: many(params.status).filter(isApplicationStatus),
    source: many(params.source).filter(isApplicationSource),
    company: first(params.company).slice(0, 200),
    position: first(params.position).slice(0, 200),
    location: first(params.location).slice(0, 200),
    from: DATE_RE.test(from) ? from : "",
    to: DATE_RE.test(to) ? to : "",
    sort: (SORT_FIELDS as readonly string[]).includes(sort) ? (sort as SortField) : DEFAULT_QUERY.sort,
    order: order === "asc" || order === "desc" ? order : DEFAULT_QUERY.order,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: (PAGE_SIZES as readonly number[]).includes(pageSize) ? pageSize : DEFAULT_QUERY.pageSize,
  };
}

/** Serialises a query back to URL params, omitting defaults to keep URLs short. */
export function serializeApplicationQuery(query: Partial<ApplicationQuery>): URLSearchParams {
  const merged = { ...DEFAULT_QUERY, ...query };
  const params = new URLSearchParams();
  if (merged.q) params.set("q", merged.q);
  if (merged.status.length) params.set("status", merged.status.join(","));
  if (merged.source.length) params.set("source", merged.source.join(","));
  if (merged.company) params.set("company", merged.company);
  if (merged.position) params.set("position", merged.position);
  if (merged.location) params.set("location", merged.location);
  if (merged.from) params.set("from", merged.from);
  if (merged.to) params.set("to", merged.to);
  if (merged.sort !== DEFAULT_QUERY.sort) params.set("sort", merged.sort);
  if (merged.order !== DEFAULT_QUERY.order) params.set("order", merged.order);
  if (merged.page !== 1) params.set("page", String(merged.page));
  if (merged.pageSize !== DEFAULT_QUERY.pageSize) params.set("pageSize", String(merged.pageSize));
  return params;
}

export function hasActiveFilters(query: ApplicationQuery): boolean {
  return Boolean(
    query.q ||
      query.status.length ||
      query.source.length ||
      query.company ||
      query.position ||
      query.location ||
      query.from ||
      query.to,
  );
}

/**
 * Builds the Prisma filter. `contains` is case-insensitive because MySQL's default
 * utf8mb4_0900_ai_ci collation is case- and accent-insensitive.
 */
export function buildApplicationWhere(query: ApplicationQuery): Prisma.ApplicationWhereInput {
  const and: Prisma.ApplicationWhereInput[] = [];

  if (query.q) {
    const q = query.q;
    and.push({
      OR: [
        { applicationId: { contains: q } },
        { company: { contains: q } },
        { position: { contains: q } },
        { location: { contains: q } },
        { techStack: { some: { name: { contains: q } } } },
      ],
    });
  }
  if (query.status.length) and.push({ status: { in: query.status } });
  if (query.source.length) and.push({ source: { in: query.source } });
  if (query.company) and.push({ company: { contains: query.company } });
  if (query.position) and.push({ position: { contains: query.position } });
  if (query.location) and.push({ location: { contains: query.location } });

  const from = parseDateOnly(query.from);
  const to = parseDateOnly(query.to);
  if (from || to) {
    and.push({ dateApplied: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } });
  }

  return and.length ? { AND: and } : {};
}

export function buildApplicationOrderBy(query: ApplicationQuery): Prisma.ApplicationOrderByWithRelationInput[] {
  const primary: Prisma.ApplicationOrderByWithRelationInput =
    query.sort === "dateApplied"
      ? { dateApplied: { sort: query.order, nulls: query.order === "desc" ? "last" : "first" } }
      : { [query.sort]: query.order };
  // Stable secondary order so pagination is deterministic.
  return [primary, { createdAt: "desc" }, { id: "asc" }];
}

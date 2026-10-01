import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Briefcase, Plus, SearchX } from "lucide-react";
import { ApplicationsPagination } from "@/components/applications/applications-pagination";
import { ApplicationsTable } from "@/components/applications/applications-table";
import { ApplicationsToolbar } from "@/components/applications/applications-toolbar";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { hasActiveFilters, parseApplicationQuery } from "@/lib/applications/query";
import { getApplicationFilterOptions, listApplications } from "@/lib/applications/service";

export const metadata: Metadata = { title: "Applications" };

export default async function ApplicationsPage(props: PageProps<"/applications">) {
  const query = parseApplicationQuery(await props.searchParams);
  const [result, options] = await Promise.all([listApplications(query), getApplicationFilterOptions()]);
  const filtered = hasActiveFilters(query);

  return (
    <>
      <PageHeader
        title="Applications"
        description="Track every job application, its status and its email."
        actions={
          <Button asChild>
            <Link href="/applications/new">
              <Plus /> New application
            </Link>
          </Button>
        }
      />
      <Suspense>
        <ApplicationsToolbar locations={options.locations} />
      </Suspense>
      {result.total === 0 ? (
        filtered ? (
          <EmptyState
            icon={SearchX}
            title="No matching applications"
            description="Try a different search term or clear the filters."
          />
        ) : (
          <EmptyState
            icon={Briefcase}
            title="No applications yet"
            description="Create your first application to start tracking it."
            action={
              <Button asChild>
                <Link href="/applications/new">
                  <Plus /> New application
                </Link>
              </Button>
            }
          />
        )
      ) : (
        <>
          <ApplicationsTable items={result.items} query={query} />
          <ApplicationsPagination query={query} total={result.total} pageCount={result.pageCount} />
        </>
      )}
    </>
  );
}

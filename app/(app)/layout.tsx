import { AppSidebar, MobileHeader } from "@/components/layout/app-sidebar";
import { requirePageAuth } from "@/lib/auth/session";

/** Authenticated app shell. `requirePageAuth` reads cookies, so every page renders per request. */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requirePageAuth();
  return (
    <div className="flex min-h-dvh">
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />
        <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

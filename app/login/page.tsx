import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Briefcase } from "lucide-react";
import { LoginForm } from "@/components/shared/login-form";
import { isAuthenticated } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage(props: PageProps<"/login">) {
  if (await isAuthenticated()) redirect("/");
  const { next } = await props.searchParams;
  return (
    <div className="flex min-h-dvh items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-sm space-y-6 rounded-2xl border bg-card p-8 shadow-sm">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Briefcase className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Sign in to JobTrack</h1>
            <p className="text-sm text-muted-foreground">Enter the password configured in APP_PASSWORD.</p>
          </div>
        </div>
        <LoginForm next={typeof next === "string" ? next : "/"} />
      </div>
    </div>
  );
}

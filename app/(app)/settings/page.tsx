import type { Metadata } from "next";
import { CheckCircle2, XCircle } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PageHeader } from "@/components/shared/page-header";
import { ProfileForm } from "@/components/shared/profile-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getEmailUsage } from "@/lib/email/service";
import { getServerEnv } from "@/lib/env";
import { getProfile } from "@/lib/profile/service";

export const metadata: Metadata = { title: "Settings" };

function Check({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {ok ? <CheckCircle2 className="mt-0.5 size-4 text-emerald-600" /> : <XCircle className="mt-0.5 size-4 text-destructive" />}
      <span>
        {label}
        {detail ? <span className="block text-xs text-muted-foreground">{detail}</span> : null}
      </span>
    </li>
  );
}

export default async function SettingsPage() {
  const [profile, usage] = await Promise.all([getProfile(), getEmailUsage()]);
  const env = getServerEnv();
  // Only presence is shown — secret values never leave the server.
  const hasKeys = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);

  return (
    <>
      <PageHeader title="Settings" description="Profile used in templates, appearance and email configuration." />
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Values for {"{{name}}"}, {"{{email}}"} and {"{{phone}}"} in email templates.</CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm defaultValues={profile} />
        </CardContent>
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Light, dark or follow your system.</CardDescription>
          </CardHeader>
          <CardContent>
            <ThemeToggle />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Email (Amazon SES)</CardTitle>
            <CardDescription>Read-only; configured through environment variables (docs/aws/ses.md).</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              <Check
                ok={env.EMAIL_TRANSPORT === "ses"}
                label={`Transport: ${env.EMAIL_TRANSPORT}`}
                detail={env.EMAIL_TRANSPORT === "mock" ? "Mock mode — emails are not really sent" : undefined}
              />
              <Check ok={Boolean(env.SES_FROM_EMAIL)} label={`Sender: ${env.SES_FROM_EMAIL || "SES_FROM_EMAIL not set"}`} />
              <Check ok={Boolean(env.AWS_REGION)} label={`Region: ${env.AWS_REGION}`} />
              <Check
                ok={hasKeys}
                label={hasKeys ? "AWS access keys present (server-side)" : "No access keys in env"}
                detail={hasKeys ? undefined : "Fine if the server runs with an IAM role"}
              />
              <Check
                ok={Boolean(env.SES_CONFIGURATION_SET)}
                label={`Configuration set: ${env.SES_CONFIGURATION_SET || "none"}`}
                detail="Required for delivery tracking (docs/aws/email-events.md)"
              />
              <Check
                ok={usage.sentLastHour < usage.limit}
                label={`Rate limit: ${usage.sentLastHour} / ${usage.limit} emails in the last hour`}
              />
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { EmailComposer } from "@/components/email/email-composer";
import { PageHeader } from "@/components/shared/page-header";
import { getApplication } from "@/lib/applications/service";
import { listDocuments } from "@/lib/documents/service";
import { getServerEnv } from "@/lib/env";
import { getProfile } from "@/lib/profile/service";
import { listTemplates } from "@/lib/templates/service";

export const metadata: Metadata = { title: "Compose email" };

export default async function ComposePage(props: PageProps<"/applications/[id]/compose">) {
  const { id } = await props.params;
  const [app, documents, templates, profile] = await Promise.all([
    getApplication(id),
    listDocuments(),
    listTemplates(),
    getProfile(),
  ]);
  if (!app) notFound();

  const env = getServerEnv();
  const configured = env.EMAIL_TRANSPORT === "mock" || Boolean(env.SES_FROM_EMAIL);
  const sender =
    env.EMAIL_TRANSPORT === "mock"
      ? `${env.SES_FROM_EMAIL || "mock sender"} (mock transport — nothing is really sent)`
      : env.SES_FROM_NAME
        ? `${env.SES_FROM_NAME} <${env.SES_FROM_EMAIL}>`
        : env.SES_FROM_EMAIL || "not configured";

  // Prefer the application's linked documents; fall back to default CV/cover letter.
  const linked = app.documents.map((d) => d.documentId);
  const defaults = documents.filter((d) => d.isDefault && d.type !== "OTHER").map((d) => d.id);

  return (
    <>
      <PageHeader
        title="Compose application email"
        description={`${app.applicationId} · ${app.position} at ${app.company}`}
      />
      {!configured ? (
        <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <span>
            SES_FROM_EMAIL is not configured, so sending will fail. See docs/aws/ses.md.
          </span>
        </div>
      ) : null}
      <EmailComposer
        application={{
          id: app.id,
          applicationId: app.applicationId,
          company: app.company,
          position: app.position,
          location: app.location,
        }}
        defaults={{
          to: app.recipientEmail ?? "",
          cc: app.cc ?? "",
          bcc: app.bcc ?? "",
          subject: app.emailSubject ?? `Application for ${app.position}`,
          message: app.emailBody ?? "",
          documentIds: linked.length ? linked : defaults,
        }}
        documents={documents.map(({ id, name, type, size, originalFilename }) => ({ id, name, type, size, originalFilename }))}
        templates={templates.map(({ id, name, subject, body }) => ({ id, name, subject, body }))}
        profile={{ name: profile.fullName, email: profile.email, phone: profile.phone }}
        sender={sender}
      />
    </>
  );
}

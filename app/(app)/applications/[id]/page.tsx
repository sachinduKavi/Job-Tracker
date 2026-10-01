import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, FileText, Mail, Paperclip } from "lucide-react";
import { AddNoteForm } from "@/components/applications/add-note-form";
import { DetailActions } from "@/components/applications/detail-actions";
import { EmailStatusBadge, StatusBadge } from "@/components/applications/status-badge";
import { Timeline } from "@/components/applications/timeline";
import { EmailHtmlPreview } from "@/components/email/email-html-preview";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getApplication } from "@/lib/applications/service";
import { getSourceLabel } from "@/lib/applications/source";
import { getStatusLabel } from "@/lib/applications/status";
import { DOCUMENT_TYPE_LABELS, formatFileSize } from "@/lib/documents/validation";
import { formatDate, formatDateTime } from "@/lib/format";

export async function generateMetadata(props: PageProps<"/applications/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const app = await getApplication(id);
  return { title: app ? `${app.applicationId} · ${app.company}` : "Application" };
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-span-2 min-w-0 break-words">{children}</dd>
    </div>
  );
}

const ROLE_LABEL = { CV: "CV", COVER_LETTER: "Cover letter", ADDITIONAL: "Additional" } as const;

export default async function ApplicationDetailsPage(props: PageProps<"/applications/[id]">) {
  const { id } = await props.params;
  const app = await getApplication(id);
  if (!app) notFound();
  const latestEmail = app.emails[0];

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {app.position}
            <StatusBadge status={app.status} className="text-sm" />
          </span>
        }
        description={
          <span>
            <span className="font-mono">{app.applicationId}</span> · {app.company}
            {app.location ? ` · ${app.location}` : ""}
          </span>
        }
        actions={
          <DetailActions
            application={{
              id: app.id,
              applicationId: app.applicationId,
              company: app.company,
              position: app.position,
              status: app.status,
            }}
          />
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Application information</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="divide-y">
                <InfoRow label="Application ID">
                  <span className="font-mono" data-testid="application-id">{app.applicationId}</span>
                </InfoRow>
                <InfoRow label="Company">{app.company}</InfoRow>
                <InfoRow label="Position">{app.position}</InfoRow>
                <InfoRow label="Tech stack">
                  {app.techStack.length ? (
                    <div className="flex flex-wrap gap-1">
                      {app.techStack.map((t) => (
                        <span key={t.id} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {t.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    "—"
                  )}
                </InfoRow>
                <InfoRow label="Location">{app.location ?? "—"}</InfoRow>
                <InfoRow label="Source">{getSourceLabel(app.source)}</InfoRow>
                <InfoRow label="Job URL">
                  {app.jobUrl ? (
                    <a href={app.jobUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      <span className="truncate">{app.jobUrl}</span>
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                  ) : (
                    "—"
                  )}
                </InfoRow>
                <InfoRow label="Current status">
                  <span data-testid="current-status">
                    <StatusBadge status={app.status} />
                  </span>
                </InfoRow>
                <InfoRow label="Date applied">{formatDate(app.dateApplied)}</InfoRow>
                <InfoRow label="Last updated">{formatDateTime(app.updatedAt)}</InfoRow>
                {app.notes ? <InfoRow label="Notes"><p className="whitespace-pre-wrap">{app.notes}</p></InfoRow> : null}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Email</CardTitle>
              <CardDescription>
                Delivery status is tracked separately from the application status — “Delivered” means the
                employer&apos;s mail server accepted it, not that it was read.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {latestEmail ? (
                <>
                  <dl className="divide-y" data-testid="latest-email">
                    <InfoRow label="Recipient">{latestEmail.to}</InfoRow>
                    <InfoRow label="CC">{latestEmail.cc || "—"}</InfoRow>
                    <InfoRow label="BCC">{latestEmail.bcc || "—"}</InfoRow>
                    <InfoRow label="Subject">{latestEmail.subject}</InfoRow>
                    <InfoRow label="Sent">{formatDateTime(latestEmail.sentAt)}</InfoRow>
                    <InfoRow label="SES Message ID">
                      <span className="font-mono text-xs break-all" data-testid="ses-message-id">
                        {latestEmail.sesMessageId ?? "—"}
                      </span>
                    </InfoRow>
                    <InfoRow label="Delivery status">
                      <span data-testid="email-status">
                        <EmailStatusBadge status={latestEmail.emailStatus} />
                      </span>
                      {latestEmail.errorMessage ? (
                        <p className="mt-1 text-xs text-destructive">{latestEmail.errorMessage}</p>
                      ) : null}
                    </InfoRow>
                    <InfoRow label="Attachments">
                      {latestEmail.attachments.length ? (
                        <ul className="space-y-1">
                          {latestEmail.attachments.map((a) => (
                            <li key={a.id} className="flex items-center gap-1.5 text-sm">
                              <Paperclip className="size-3.5 text-muted-foreground" />
                              {a.filename} <span className="text-xs text-muted-foreground">({formatFileSize(a.size)})</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        "—"
                      )}
                    </InfoRow>
                  </dl>
                  <EmailHtmlPreview html={latestEmail.body} />
                  {app.emails.length > 1 ? (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">Earlier emails</h4>
                      <ul className="divide-y rounded-lg border text-sm">
                        {app.emails.slice(1).map((e) => (
                          <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                            <span className="min-w-0 truncate">
                              {e.subject} <span className="text-muted-foreground">→ {e.to}</span>
                            </span>
                            <span className="flex items-center gap-2 text-xs text-muted-foreground">
                              {formatDateTime(e.sentAt ?? e.createdAt)}
                              <EmailStatusBadge status={e.emailStatus} />
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="flex flex-col items-start gap-3 text-sm text-muted-foreground">
                  <p>No email has been sent for this application yet.</p>
                  {app.recipientEmail ? <p>Draft recipient: {app.recipientEmail}</p> : null}
                  <Button asChild size="sm">
                    <Link href={`/applications/${app.id}/compose`}>
                      <Mail /> Compose email
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
            </CardHeader>
            <CardContent>
              {app.documents.length ? (
                <ul className="divide-y rounded-lg border">
                  {app.documents.map((d) => (
                    <li key={d.id} className="flex items-center gap-3 p-3 text-sm">
                      <FileText className="size-4 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{d.document.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {ROLE_LABEL[d.role]} · {DOCUMENT_TYPE_LABELS[d.document.type]} · {formatFileSize(d.document.size)}
                        </p>
                      </div>
                      <Button asChild variant="ghost" size="sm">
                        <a href={`/api/documents/${d.document.id}/download?inline=1`} target="_blank" rel="noopener">
                          Open
                        </a>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No documents attached. Edit the application to add a CV or cover letter.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <AddNoteForm applicationId={app.id} />
              <Timeline events={app.events} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Status history</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm">
                {app.statusHistory.map((h) => (
                  <li key={h.id} className="flex flex-col gap-0.5">
                    <span>
                      {h.fromStatus ? `${getStatusLabel(h.fromStatus)} → ` : ""}
                      <span className="font-medium">{getStatusLabel(h.toStatus)}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(h.createdAt)}
                      {h.note ? ` · ${h.note}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

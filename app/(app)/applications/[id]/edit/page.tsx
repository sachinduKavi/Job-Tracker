import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApplicationForm } from "@/components/applications/application-form";
import { PageHeader } from "@/components/shared/page-header";
import { getApplication } from "@/lib/applications/service";
import { listDocuments } from "@/lib/documents/service";
import { getProfile } from "@/lib/profile/service";
import { listTemplates } from "@/lib/templates/service";
import { toDateInputValue } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Edit application" };

export default async function EditApplicationPage(props: PageProps<"/applications/[id]/edit">) {
  const { id } = await props.params;
  const [application, documents, templates, profile] = await Promise.all([
    getApplication(id),
    listDocuments(),
    listTemplates(),
    getProfile(),
  ]);
  if (!application) notFound();

  const byRole = (role: string) => application.documents.filter((d) => d.role === role).map((d) => d.documentId);

  return (
    <>
      <PageHeader title={`Edit ${application.applicationId}`} description={`${application.position} at ${application.company}`} />
      <ApplicationForm
        mode="edit"
        applicationId={application.id}
        initialStatus={application.status}
        documents={documents.map(({ id, name, type, isDefault }) => ({ id, name, type, isDefault }))}
        templates={templates.map(({ id, name, subject, body }) => ({ id, name, subject, body }))}
        profile={{ name: profile.fullName, email: profile.email, phone: profile.phone }}
        defaultValues={{
          company: application.company,
          position: application.position,
          dateApplied: toDateInputValue(application.dateApplied),
          location: application.location ?? "",
          jobUrl: application.jobUrl ?? "",
          source: application.source,
          techStack: application.techStack.map((t) => t.name).join(", "),
          status: application.status,
          notes: application.notes ?? "",
          recipientEmail: application.recipientEmail ?? "",
          cc: application.cc ?? "",
          bcc: application.bcc ?? "",
          emailSubject: application.emailSubject ?? "",
          emailBody: application.emailBody ?? "",
          cvId: byRole("CV")[0] ?? "",
          coverLetterId: byRole("COVER_LETTER")[0] ?? "",
          additionalDocumentIds: byRole("ADDITIONAL"),
        }}
      />
    </>
  );
}

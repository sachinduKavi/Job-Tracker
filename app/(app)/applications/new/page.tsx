import type { Metadata } from "next";
import { ApplicationForm } from "@/components/applications/application-form";
import { PageHeader } from "@/components/shared/page-header";
import { listDocuments } from "@/lib/documents/service";
import { getProfile } from "@/lib/profile/service";
import { listTemplates } from "@/lib/templates/service";

export const metadata: Metadata = { title: "New application" };

export default async function NewApplicationPage() {
  const [documents, templates, profile] = await Promise.all([listDocuments(), listTemplates(), getProfile()]);
  const defaultCv = documents.find((d) => d.type === "CV" && d.isDefault);

  return (
    <>
      <PageHeader title="New application" description="Record a job application. You can send the email afterwards." />
      <ApplicationForm
        mode="create"
        documents={documents.map(({ id, name, type, isDefault }) => ({ id, name, type, isDefault }))}
        templates={templates.map(({ id, name, subject, body }) => ({ id, name, subject, body }))}
        profile={{ name: profile.fullName, email: profile.email, phone: profile.phone }}
        defaultValues={{
          company: "",
          position: "",
          dateApplied: "",
          location: "",
          jobUrl: "",
          source: "LINKEDIN",
          techStack: "",
          status: "DRAFT",
          notes: "",
          recipientEmail: "",
          cc: "",
          bcc: "",
          emailSubject: "",
          emailBody: "",
          cvId: defaultCv?.id ?? "",
          coverLetterId: "",
          additionalDocumentIds: [],
        }}
      />
    </>
  );
}

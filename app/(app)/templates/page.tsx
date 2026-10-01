import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { TemplatesManager } from "@/components/templates/templates-manager";
import { getProfile } from "@/lib/profile/service";
import { listTemplates } from "@/lib/templates/service";

export const metadata: Metadata = { title: "Email templates" };

export default async function TemplatesPage() {
  const [templates, profile] = await Promise.all([listTemplates(), getProfile()]);
  return (
    <>
      <PageHeader
        title="Email templates"
        description="Reusable application emails. Supported variables: {{company}}, {{position}}, {{name}}, {{email}}, {{phone}}, {{location}}."
      />
      <TemplatesManager
        templates={templates.map((t) => ({ id: t.id, name: t.name, subject: t.subject, body: t.body, updatedAt: t.updatedAt.toISOString() }))}
        sampleValues={{
          company: "Veyrion",
          position: "Associate Software Engineer",
          location: "Colombo",
          name: profile.fullName || "Your Name",
          email: profile.email || "you@example.com",
          phone: profile.phone || "+94 77 000 0000",
        }}
      />
    </>
  );
}

import type { Metadata } from "next";
import { DocumentsManager } from "@/components/documents/documents-manager";
import { UploadDocumentDialog } from "@/components/documents/upload-document-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { listDocuments } from "@/lib/documents/service";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const documents = await listDocuments();
  return (
    <>
      <PageHeader
        title="Documents"
        description="Your CVs, cover letters and other files. The default of each type is pre-selected for new applications."
        actions={<UploadDocumentDialog />}
      />
      <DocumentsManager
        documents={documents.map((d) => ({
          id: d.id,
          name: d.name,
          type: d.type,
          originalFilename: d.originalFilename,
          mimeType: d.mimeType,
          size: d.size,
          isDefault: d.isDefault,
          createdAt: d.createdAt.toISOString(),
          applicationCount: d._count.applications,
        }))}
      />
    </>
  );
}

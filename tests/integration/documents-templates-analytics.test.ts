import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { getDashboardStats, getMonthlyTrend, getStatusBreakdown, getTechnologyBreakdown } from "@/lib/analytics/service";
import { changeApplicationStatus, createApplication } from "@/lib/applications/service";
import type { ApplicationInput } from "@/lib/applications/schemas";
import { deleteDocument, getDocumentWithContent, renameDocument, setDefaultDocument, uploadDocument } from "@/lib/documents/service";
import { getServerEnv } from "@/lib/env";
import { createTemplate, deleteTemplate, listTemplates, updateTemplate } from "@/lib/templates/service";
import { EXE_BYTES, PDF_BYTES } from "../support/fixtures";

const pdf = (name = "cv.pdf") => ({ name, size: PDF_BYTES.length, bytes: PDF_BYTES });
const storagePath = (key: string) => path.resolve(process.cwd(), getServerEnv().STORAGE_DIR, key);

describe("documents", () => {
  it("stores files under random keys and manages one default per type", async () => {
    const a = await uploadDocument({ name: "Backend CV", type: "CV", isDefault: false, file: pdf() });
    expect(a.isDefault).toBe(true); // first of its type becomes default
    expect(a.storageKey).toMatch(/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.pdf$/);
    expect(existsSync(storagePath(a.storageKey))).toBe(true);

    const b = await uploadDocument({ name: "Full Stack CV", type: "CV", isDefault: true, file: pdf() });
    const cover = await uploadDocument({ name: "Cover", type: "COVER_LETTER", isDefault: false, file: pdf() });
    expect((await db.document.findUnique({ where: { id: a.id } }))?.isDefault).toBe(false);
    expect(b.isDefault).toBe(true);
    expect(cover.isDefault).toBe(true);

    await setDefaultDocument(a.id);
    expect((await db.document.findUnique({ where: { id: b.id } }))?.isDefault).toBe(false);

    await renameDocument(a.id, ".NET Developer CV");
    const { document, content } = await getDocumentWithContent(a.id);
    expect(document.name).toBe(".NET Developer CV");
    expect(new Uint8Array(content)).toEqual(PDF_BYTES);

    await deleteDocument(a.id);
    expect(existsSync(storagePath(a.storageKey))).toBe(false);
    expect((await db.document.findUnique({ where: { id: b.id } }))?.isDefault).toBe(true); // default promoted
  });

  it("rejects files whose content does not match an allowed type", async () => {
    await expect(
      uploadDocument({ name: "x", type: "CV", isDefault: false, file: { name: "cv.pdf", size: 4, bytes: EXE_BYTES } }),
    ).rejects.toMatchObject({ code: "VALIDATION" });
    expect(await db.document.count()).toBe(0);
  });
});

describe("email templates", () => {
  it("supports CRUD and enforces unique names", async () => {
    const t = await createTemplate({ name: "General", subject: "Application for {{position}}", body: "Hi {{company}}" });
    await expect(createTemplate({ name: "General", subject: "x", body: "y" })).rejects.toMatchObject({ code: "CONFLICT" });
    await updateTemplate(t.id, { name: "General v2", subject: "s", body: "b" });
    expect((await listTemplates()).map((x) => x.name)).toEqual(["General v2"]);
    await deleteTemplate(t.id);
    expect(await listTemplates()).toEqual([]);
    await expect(deleteTemplate(t.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("analytics", () => {
  const base: ApplicationInput = {
    company: "C",
    position: "P",
    dateApplied: null,
    location: "Colombo",
    jobUrl: null,
    source: "LINKEDIN",
    techStack: ["React"],
    status: "APPLIED",
    notes: null,
    recipientEmail: null,
    cc: null,
    bcc: null,
    emailSubject: null,
    emailBody: null,
    documents: [],
  };

  it("counts by current status, month and technology", async () => {
    const now = new Date();
    const thisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const lastYear = new Date(Date.UTC(now.getUTCFullYear() - 1, now.getUTCMonth(), 1));

    const a = await createApplication({ ...base, dateApplied: thisMonth });
    await createApplication({ ...base, dateApplied: lastYear, techStack: ["React", "Node.js"] });
    await createApplication({ ...base, status: "OFFER", dateApplied: thisMonth, techStack: ["react"] });
    await createApplication({ ...base, status: "NO_RESPONSE", dateApplied: lastYear });
    await changeApplicationStatus(a.id, "HR_SCREENING");

    expect(await getDashboardStats(now)).toEqual({
      total: 4,
      thisMonth: 2,
      interviews: 1,
      offers: 1,
      rejected: 0,
      noResponse: 1,
    });

    const byStatus = await getStatusBreakdown();
    expect(byStatus.find((s) => s.status === "HR_SCREENING")?.count).toBe(1);
    expect(byStatus).toHaveLength(10);

    const trend = await getMonthlyTrend(now, 12);
    expect(trend).toHaveLength(12);
    expect(trend[11].count).toBe(2);
    expect(trend.reduce((s, m) => s + m.count, 0)).toBe(2); // last year is outside the 12-month window

    const tech = await getTechnologyBreakdown();
    expect(tech[0]).toEqual({ name: expect.stringMatching(/^react$/i), count: 4 }); // case-insensitive collation groups React/react
  });
});

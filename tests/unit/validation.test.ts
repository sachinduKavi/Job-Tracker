import { describe, expect, it } from "vitest";
import { applicationFormSchema, parseTechStack, toApplicationInput, type ApplicationFormValues } from "@/lib/applications/schemas";
import { validateDocumentFile, sanitizeFilename, MAX_DOCUMENT_SIZE_BYTES } from "@/lib/documents/validation";
import { composeEmailSchema } from "@/lib/email/schemas";
import { parseEmailList, toFieldErrors } from "@/lib/validation/common";
import { PDF_BYTES, DOCX_MAGIC, EXE_BYTES } from "../support/fixtures";

const valid: ApplicationFormValues = {
  company: "Veyrion",
  position: "Associate Software Engineer",
  dateApplied: "2026-10-01",
  location: "Colombo",
  jobUrl: "https://veyrion.example/jobs/1",
  source: "LINKEDIN",
  techStack: "C#, .NET, React",
  status: "DRAFT",
  notes: "",
  recipientEmail: "people@veyrion.example",
  cc: "a@x.com, b@y.com",
  bcc: "",
  emailSubject: "",
  emailBody: "",
  cvId: "cv1",
  coverLetterId: "",
  additionalDocumentIds: ["extra", "cv1"],
};

describe("applicationFormSchema", () => {
  it("accepts a valid application", () => {
    expect(applicationFormSchema.safeParse(valid).success).toBe(true);
  });

  it("requires company and position", () => {
    const result = applicationFormSchema.safeParse({ ...valid, company: "  ", position: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = toFieldErrors(result.error);
      expect(errors.company).toMatch(/required/);
      expect(errors.position).toMatch(/required/);
    }
  });

  it("rejects invalid emails, URLs, dates and unknown statuses", () => {
    expect(applicationFormSchema.safeParse({ ...valid, recipientEmail: "nope" }).success).toBe(false);
    expect(applicationFormSchema.safeParse({ ...valid, cc: "ok@x.com, bad" }).success).toBe(false);
    expect(applicationFormSchema.safeParse({ ...valid, jobUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(applicationFormSchema.safeParse({ ...valid, dateApplied: "01/10/2026" }).success).toBe(false);
    expect(applicationFormSchema.safeParse({ ...valid, status: "INTERVIEW" }).success).toBe(false);
  });

  it("normalises form values for the service layer", () => {
    const input = toApplicationInput(applicationFormSchema.parse(valid));
    expect(input.techStack).toEqual(["C#", ".NET", "React"]);
    expect(input.dateApplied?.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(input.notes).toBeNull();
    expect(input.cc).toBe("a@x.com, b@y.com");
    expect(input.bcc).toBeNull();
    // CV is not duplicated as an additional document.
    expect(input.documents).toEqual([
      { documentId: "cv1", role: "CV" },
      { documentId: "extra", role: "ADDITIONAL" },
    ]);
  });
});

describe("parseTechStack / parseEmailList", () => {
  it("trims, de-duplicates case-insensitively and drops empties", () => {
    expect(parseTechStack(" React , node.js,react,, Node.js ")).toEqual(["React", "node.js"]);
    expect(parseEmailList("a@x.com; A@x.com\nb@y.com,")).toEqual(["a@x.com", "b@y.com"]);
  });
});

describe("composeEmailSchema", () => {
  const base = {
    applicationId: "app1",
    to: "people@company.com",
    cc: "",
    bcc: "",
    subject: "Application",
    html: "<p>Hello</p>",
    text: "Hello",
    documentIds: [],
    idempotencyKey: "0123456789abcdef0123",
    allowResend: false,
  };
  it("accepts a valid email and rejects a missing recipient or short key", () => {
    expect(composeEmailSchema.safeParse(base).success).toBe(true);
    expect(composeEmailSchema.safeParse({ ...base, to: "" }).success).toBe(false);
    expect(composeEmailSchema.safeParse({ ...base, idempotencyKey: "short" }).success).toBe(false);
  });
});

describe("document file validation", () => {
  it("accepts PDFs and DOCX by magic bytes", () => {
    expect(validateDocumentFile({ name: "cv.pdf", size: PDF_BYTES.length, bytes: PDF_BYTES }).ok).toBe(true);
    expect(validateDocumentFile({ name: "cv.DOCX", size: 100, bytes: DOCX_MAGIC }).ok).toBe(true);
  });

  it("rejects disguised, unsupported, empty and oversized files", () => {
    expect(validateDocumentFile({ name: "cv.pdf", size: 4, bytes: EXE_BYTES })).toMatchObject({ ok: false });
    expect(validateDocumentFile({ name: "virus.exe", size: 4, bytes: EXE_BYTES })).toMatchObject({ ok: false });
    expect(validateDocumentFile({ name: "cv.pdf", size: 0, bytes: new Uint8Array() })).toMatchObject({ ok: false });
    expect(
      validateDocumentFile({ name: "cv.pdf", size: MAX_DOCUMENT_SIZE_BYTES + 1, bytes: PDF_BYTES }),
    ).toMatchObject({ ok: false, error: expect.stringMatching(/5 MB/) });
  });

  it("sanitizes filenames", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("C:\\Users\\me\\My CV (2026).pdf")).toBe("My_CV_(2026).pdf");
    expect(sanitizeFilename("<script>.pdf")).toBe("script_.pdf");
  });
});

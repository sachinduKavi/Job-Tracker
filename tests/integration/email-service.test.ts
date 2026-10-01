import { afterEach, describe, expect, it } from "vitest";
import type { SendEmailCommand } from "@aws-sdk/client-sesv2";
import { db } from "@/lib/db";
import { createApplication, getApplication } from "@/lib/applications/service";
import { uploadDocument } from "@/lib/documents/service";
import { applySesEvent } from "@/lib/email/delivery-events";
import { sendEmailForApplication } from "@/lib/email/service";
import { getMockOutbox, setSesClientForTesting } from "@/lib/email/ses";
import { resetServerEnvForTesting } from "@/lib/env";
import type { ComposeEmailValues } from "@/lib/email/schemas";
import { PDF_BYTES } from "../support/fixtures";

let keyCounter = 0;
const key = () => `test-key-${Date.now()}-${keyCounter++}`.padEnd(20, "x");

async function setup() {
  const cv = await uploadDocument({
    name: "Backend Developer CV",
    type: "CV",
    isDefault: true,
    file: { name: "Sachindu_Kavishka_CV.pdf", size: PDF_BYTES.length, bytes: PDF_BYTES },
  });
  const app = await createApplication({
    company: "Veyrion",
    position: "Associate Software Engineer",
    dateApplied: null,
    location: "Colombo",
    jobUrl: null,
    source: "LINKEDIN",
    techStack: ["C#"],
    status: "DRAFT",
    notes: null,
    recipientEmail: "people@veyrion.example",
    cc: null,
    bcc: null,
    emailSubject: null,
    emailBody: null,
    documents: [{ documentId: cv.id, role: "CV" }],
  });
  const values = (overrides: Partial<ComposeEmailValues> = {}): ComposeEmailValues => ({
    applicationId: app.id,
    to: "people@veyrion.example",
    cc: "hr@veyrion.example",
    bcc: "",
    subject: "Application for Associate Software Engineer",
    html: '<p>Dear Hiring Team,</p><script>alert(1)</script><p onclick="x()">Regards</p>',
    text: "",
    documentIds: [cv.id],
    idempotencyKey: key(),
    allowResend: false,
    ...overrides,
  });
  return { app, cv, values };
}

function useSesTransport(client: { send: (c: SendEmailCommand) => Promise<{ MessageId?: string }> }) {
  process.env.EMAIL_TRANSPORT = "ses";
  resetServerEnvForTesting();
  setSesClientForTesting(client);
}

afterEach(() => {
  process.env.EMAIL_TRANSPORT = "mock";
  process.env.EMAIL_RATE_LIMIT_PER_HOUR = "1000";
  resetServerEnvForTesting();
  setSesClientForTesting(undefined);
  getMockOutbox().length = 0;
});

describe("email send flow (mock transport)", () => {
  it("stores the message ID, marks the email Sent and moves Draft → Applied", async () => {
    const { app, values } = await setup();
    const { email, duplicate } = await sendEmailForApplication(values());

    expect(duplicate).toBe(false);
    expect(email.emailStatus).toBe("SENT");
    expect(email.sesMessageId).toMatch(/^mock-/);
    expect(email.sentAt).toBeInstanceOf(Date);
    // HTML was sanitized before storage and sending.
    expect(email.body).not.toMatch(/script|onclick/);
    expect(email.textBody).toContain("Dear Hiring Team,");

    const details = await getApplication(app.id);
    expect(details?.status).toBe("APPLIED");
    expect(details?.dateApplied).toBeInstanceOf(Date);
    expect(details?.statusHistory[0]).toMatchObject({ fromStatus: "DRAFT", toStatus: "APPLIED" });
    expect(details?.events.map((e) => e.eventType)).toEqual(expect.arrayContaining(["EMAIL_SENT", "STATUS_CHANGED"]));
    expect(details?.emails[0].attachments).toMatchObject([{ filename: "Sachindu_Kavishka_CV.pdf", mimeType: "application/pdf" }]);

    const [sent] = getMockOutbox();
    expect(sent.payload.to).toEqual(["people@veyrion.example"]);
    expect(sent.payload.cc).toEqual(["hr@veyrion.example"]);
    expect(sent.payload.attachments?.[0].content).toEqual(PDF_BYTES);
  });

  it("is idempotent for the same key (double submit sends once)", async () => {
    const { values } = await setup();
    const v = values();
    const first = await sendEmailForApplication(v);
    const second = await sendEmailForApplication(v);
    expect(second.duplicate).toBe(true);
    expect(second.email.id).toBe(first.email.id);
    expect(getMockOutbox()).toHaveLength(1);
    expect(await db.email.count()).toBe(1);
  });

  it("requires explicit confirmation to send again to the same recipient", async () => {
    const { values } = await setup();
    await sendEmailForApplication(values());
    await expect(sendEmailForApplication(values())).rejects.toMatchObject({ code: "DUPLICATE_SEND" });
    const resend = await sendEmailForApplication(values({ allowResend: true }));
    expect(resend.email.emailStatus).toBe("SENT");
    expect(getMockOutbox()).toHaveLength(2);
  });

  it("enforces the hourly rate limit", async () => {
    process.env.EMAIL_RATE_LIMIT_PER_HOUR = "1";
    resetServerEnvForTesting();
    const { values } = await setup();
    await sendEmailForApplication(values());
    await expect(sendEmailForApplication(values({ allowResend: true }))).rejects.toMatchObject({ code: "RATE_LIMITED" });
  });

  it("rejects unknown applications", async () => {
    const { values } = await setup();
    await expect(sendEmailForApplication(values({ applicationId: "nope" }))).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("email service behaviour (SES transport with a fake client)", () => {
  it("sends the expected SES request and stores the returned MessageId", async () => {
    process.env.SES_FROM_EMAIL = "me@example.com";
    const calls: SendEmailCommand[] = [];
    useSesTransport({
      send: async (command) => {
        calls.push(command);
        return { MessageId: "0100018f-real-ses-id" };
      },
    });
    const { values } = await setup();
    const { email } = await sendEmailForApplication(values());

    expect(email.sesMessageId).toBe("0100018f-real-ses-id");
    expect(calls).toHaveLength(1);
    const input = calls[0].input;
    expect(input.FromEmailAddress).toContain("me@example.com");
    expect(input.Destination?.ToAddresses).toEqual(["people@veyrion.example"]);
    expect(input.Content?.Simple?.Attachments?.[0]).toMatchObject({ FileName: "Sachindu_Kavishka_CV.pdf" });
    expect(input.EmailTags).toEqual([{ Name: "application", Value: "APP-0001" }]);
  });

  it("records a failure, keeps the application in Draft and surfaces an actionable error", async () => {
    process.env.SES_FROM_EMAIL = "me@example.com";
    useSesTransport({
      send: async () => {
        throw Object.assign(new Error("Email address is not verified. The following identities failed the check: people@veyrion.example"), {
          name: "MessageRejected",
        });
      },
    });
    const { app, values } = await setup();
    await expect(sendEmailForApplication(values())).rejects.toMatchObject({
      code: "EMAIL_SEND_FAILED",
      message: expect.stringMatching(/not verified/),
    });
    const details = await getApplication(app.id);
    expect(details?.status).toBe("DRAFT");
    expect(details?.emails[0]).toMatchObject({ emailStatus: "FAILED", sesMessageId: null });
    expect(details?.events[0].eventType).toBe("EMAIL_FAILED");
  });

  it("refuses to send when SES_FROM_EMAIL is missing", async () => {
    process.env.SES_FROM_EMAIL = "";
    useSesTransport({ send: async () => ({ MessageId: "x" }) });
    const { values } = await setup();
    await expect(sendEmailForApplication(values())).rejects.toMatchObject({ code: "CONFIGURATION" });
    process.env.SES_FROM_EMAIL = "tester@example.com";
  });
});

describe("delivery tracking", () => {
  it("applies SES events to the email without touching the application status", async () => {
    const { app, values } = await setup();
    const { email } = await sendEmailForApplication(values());
    const event = (status: "DELIVERED" | "COMPLAINT", type: string) => ({
      sesMessageId: email.sesMessageId!,
      status,
      type,
      description: type,
      timestamp: new Date(),
      detail: {},
    });

    expect(await applySesEvent(event("DELIVERED", "Delivery"))).toBe("updated");
    expect(await applySesEvent(event("DELIVERED", "Delivery"))).toBe("ignored"); // duplicate notification
    expect(await applySesEvent(event("COMPLAINT", "Complaint"))).toBe("updated");
    expect(await applySesEvent(event("DELIVERED", "Delivery"))).toBe("ignored"); // out of order
    expect(await applySesEvent({ ...event("DELIVERED", "Delivery"), sesMessageId: "unknown" })).toBe("unknown-message");

    const details = await getApplication(app.id);
    expect(details?.emails[0].emailStatus).toBe("COMPLAINT");
    expect(details?.status).toBe("APPLIED"); // ADR-004: delivery ≠ application progress
    expect(details?.events.map((e) => e.eventType)).toEqual(expect.arrayContaining(["EMAIL_DELIVERED", "EMAIL_COMPLAINT"]));
  });
});

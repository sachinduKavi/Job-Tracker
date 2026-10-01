import { describe, expect, it } from "vitest";
import { htmlToText, textToHtml } from "@/lib/email/content";
import { buildSendEmailInput, formatAddress } from "@/lib/email/payload";
import { sanitizeEmailHtml } from "@/lib/email/sanitize";
import { mapSesError } from "@/lib/email/ses";

describe("buildSendEmailInput", () => {
  const attachment = { filename: "Sachindu_Kavishka_CV.pdf", contentType: "application/pdf", content: new Uint8Array([1, 2, 3]) };

  it("builds an SES v2 Simple message with recipients, bodies and attachments", () => {
    const input = buildSendEmailInput({
      from: "me@example.com",
      fromName: "Sachindu Kavishka",
      replyTo: ["reply@example.com"],
      to: ["people@company.com"],
      cc: ["cc@company.com"],
      bcc: ["bcc@example.com"],
      subject: "Application for Associate Software Engineer",
      html: "<p>Hello</p>",
      text: "Hello",
      attachments: [attachment],
      configurationSetName: "jobtrack",
      tags: { application: "APP-0001" },
    });

    expect(input.FromEmailAddress).toBe('"Sachindu Kavishka" <me@example.com>');
    expect(input.Destination).toEqual({
      ToAddresses: ["people@company.com"],
      CcAddresses: ["cc@company.com"],
      BccAddresses: ["bcc@example.com"],
    });
    expect(input.ReplyToAddresses).toEqual(["reply@example.com"]);
    expect(input.Content?.Simple?.Subject).toEqual({ Data: "Application for Associate Software Engineer", Charset: "UTF-8" });
    expect(input.Content?.Simple?.Body?.Html?.Data).toBe("<p>Hello</p>");
    expect(input.Content?.Simple?.Body?.Text?.Data).toBe("Hello");
    expect(input.Content?.Simple?.Attachments).toEqual([
      {
        FileName: "Sachindu_Kavishka_CV.pdf",
        ContentType: "application/pdf",
        RawContent: attachment.content,
        ContentDisposition: "ATTACHMENT",
        ContentTransferEncoding: "BASE64",
      },
    ]);
    expect(input.ConfigurationSetName).toBe("jobtrack");
    expect(input.EmailTags).toEqual([{ Name: "application", Value: "APP-0001" }]);
  });

  it("omits empty optional parts", () => {
    const input = buildSendEmailInput({ from: "me@example.com", to: ["a@b.com"], subject: "s", html: "<p>x</p>" });
    expect(input.FromEmailAddress).toBe("me@example.com");
    expect(input.Destination?.CcAddresses).toBeUndefined();
    expect(input.Destination?.BccAddresses).toBeUndefined();
    expect(input.Content?.Simple?.Body?.Text).toBeUndefined();
    expect(input.Content?.Simple?.Attachments).toBeUndefined();
    expect(input.ConfigurationSetName).toBeUndefined();
  });

  it("requires a recipient", () => {
    expect(() => buildSendEmailInput({ from: "me@example.com", to: [], subject: "s", html: "x" })).toThrow();
  });

  it("escapes quotes in display names", () => {
    expect(formatAddress("a@b.com", 'Jane "JJ" Doe')).toBe('"Jane \\"JJ\\" Doe" <a@b.com>');
  });
});

describe("email content helpers", () => {
  it("converts text to escaped, linkified HTML paragraphs", () => {
    const html = textToHtml("Dear Team,\n\nSee https://example.com/job.\nThanks <3");
    expect(html).toBe(
      '<p>Dear Team,</p>\n<p>See <a href="https://example.com/job">https://example.com/job</a>.<br>Thanks &lt;3</p>',
    );
  });

  it("converts HTML back to readable text", () => {
    expect(htmlToText('<p>Hello &amp; welcome</p><p>Visit <a href="https://x.io">site</a><br>Bye</p>')).toBe(
      "Hello & welcome\n\nVisit site (https://x.io)\nBye",
    );
  });

  it("sanitizes dangerous HTML", () => {
    const dirty =
      '<p onclick="steal()">Hi</p><script>alert(1)</script><a href="javascript:alert(1)">x</a><img src=x onerror=alert(1)><iframe src="https://evil"></iframe><a href="https://ok.com">ok</a>';
    const clean = sanitizeEmailHtml(dirty);
    expect(clean).not.toMatch(/script|onclick|onerror|javascript:|iframe|<img/i);
    expect(clean).toContain("<p>Hi</p>");
    expect(clean).toContain('<a href="https://ok.com" rel="noopener noreferrer">ok</a>');
  });
});

describe("mapSesError", () => {
  it("maps common SES failures to actionable messages", () => {
    expect(mapSesError({ name: "MessageRejected", message: "Email address is not verified." }).message).toMatch(/not verified/);
    expect(mapSesError({ name: "AccessDeniedException", message: "" }).message).toMatch(/ses:SendEmail/);
    expect(mapSesError({ name: "UnrecognizedClientException", message: "" }).message).toMatch(/Invalid AWS credentials/);
    expect(mapSesError({ name: "Weird", message: "" }).code).toBe("EMAIL_SEND_FAILED");
  });
});

import { describe, expect, it } from "vitest";
import { fillMonthlySeries, lastMonths, topN } from "@/lib/analytics/aggregate";
import {
  DEFAULT_QUERY,
  buildApplicationWhere,
  parseApplicationQuery,
  serializeApplicationQuery,
} from "@/lib/applications/query";
import { createSessionToken, passwordMatches, verifySessionToken } from "@/lib/auth/token";
import { buildStringToSign, isTrustedSnsUrl, parseSesNotification, type SnsMessage } from "@/lib/email/sns";

describe("application query parsing", () => {
  it("parses URL params with validation and defaults", () => {
    const q = parseApplicationQuery({
      q: " react ",
      status: "APPLIED,BOGUS",
      source: ["LINKEDIN", "REFERRAL"],
      from: "2026-01-01",
      to: "not-a-date",
      sort: "company",
      order: "asc",
      page: "3",
      pageSize: "999",
    });
    expect(q).toMatchObject({
      q: "react",
      status: ["APPLIED"],
      source: ["LINKEDIN", "REFERRAL"],
      from: "2026-01-01",
      to: "",
      sort: "company",
      order: "asc",
      page: 3,
      pageSize: DEFAULT_QUERY.pageSize,
    });
    expect(parseApplicationQuery({ sort: "DROP TABLE", page: "-2" })).toMatchObject({ sort: "dateApplied", page: 1 });
  });

  it("serializes back to a minimal URL", () => {
    expect(serializeApplicationQuery({ ...DEFAULT_QUERY }).toString()).toBe("");
    expect(serializeApplicationQuery({ status: ["APPLIED", "OFFER"], page: 2 }).toString()).toBe("status=APPLIED%2COFFER&page=2");
  });

  it("builds a where clause covering search and filters", () => {
    const where = buildApplicationWhere({ ...DEFAULT_QUERY, q: "APP-0001", status: ["APPLIED"], from: "2026-01-01" });
    expect(JSON.stringify(where)).toContain('"applicationId":{"contains":"APP-0001"}');
    expect(JSON.stringify(where)).toContain('"techStack":{"some":{"name":{"contains":"APP-0001"}}}');
    expect(where).toMatchObject({ AND: expect.arrayContaining([{ status: { in: ["APPLIED"] } }]) });
    expect(buildApplicationWhere(DEFAULT_QUERY)).toEqual({});
  });
});

describe("analytics aggregation", () => {
  const now = new Date("2026-10-15T12:00:00Z");
  it("produces a contiguous monthly series", () => {
    expect(lastMonths(now, 3)).toEqual(["2026-08", "2026-09", "2026-10"]);
    const series = fillMonthlySeries([{ month: "2026-09", count: 4 }], now, 3);
    expect(series.map((s) => s.count)).toEqual([0, 4, 0]);
    expect(series[2].label).toBe("Oct 2026");
  });

  it("crosses year boundaries", () => {
    expect(lastMonths(new Date("2026-02-01T00:00:00Z"), 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });

  it("folds the tail into Other", () => {
    const rows = [
      { name: "a", count: 1 },
      { name: "b", count: 5 },
      { name: "c", count: 3 },
      { name: "d", count: 2 },
    ];
    expect(topN(rows, 2)).toEqual([
      { name: "b", count: 5 },
      { name: "c", count: 3 },
      { name: "Other", count: 3 },
    ]);
  });
});

describe("session tokens", () => {
  const secret = "x".repeat(40);
  it("verifies its own tokens and rejects tampered or expired ones", async () => {
    const token = await createSessionToken(secret, 1_000);
    expect(await verifySessionToken(token, secret, 2_000)).toBe(true);
    expect(await verifySessionToken(token, "y".repeat(40), 2_000)).toBe(false);
    expect(await verifySessionToken(token.replace(/^v1\.\d+/, "v1.99999999999999"), secret, 2_000)).toBe(false);
    expect(await verifySessionToken(token, secret, 1_000 + 8 * 24 * 3600 * 1000)).toBe(false);
    expect(await verifySessionToken(undefined, secret)).toBe(false);
  });

  it("compares passwords", async () => {
    expect(await passwordMatches("secret-1", "secret-1")).toBe(true);
    expect(await passwordMatches("secret-2", "secret-1")).toBe(false);
    expect(await passwordMatches("anything", "")).toBe(false);
  });
});

describe("SNS / SES notifications", () => {
  it("only trusts SNS-hosted HTTPS URLs", () => {
    expect(isTrustedSnsUrl("https://sns.us-east-1.amazonaws.com/SimpleNotificationService-abc.pem", "cert")).toBe(true);
    expect(isTrustedSnsUrl("https://sns.us-east-1.amazonaws.com.evil.com/x.pem", "cert")).toBe(false);
    expect(isTrustedSnsUrl("http://sns.us-east-1.amazonaws.com/x.pem", "cert")).toBe(false);
    expect(isTrustedSnsUrl("https://evil.com/x.pem", "cert")).toBe(false);
  });

  it("builds the canonical string to sign", () => {
    const msg = {
      Type: "Notification",
      MessageId: "m1",
      TopicArn: "arn:t",
      Message: "hello",
      Timestamp: "2026-10-01T00:00:00.000Z",
    } as SnsMessage;
    expect(buildStringToSign(msg)).toBe(
      "Message\nhello\nMessageId\nm1\nTimestamp\n2026-10-01T00:00:00.000Z\nTopicArn\narn:t\nType\nNotification\n",
    );
  });

  it("parses delivery, permanent/transient bounces and complaints", () => {
    const mail = { messageId: "ses-1", timestamp: "2026-10-01T00:00:00Z" };
    expect(parseSesNotification(JSON.stringify({ notificationType: "Delivery", mail, delivery: { recipients: ["a@b.com"] } }))).toMatchObject({
      sesMessageId: "ses-1",
      status: "DELIVERED",
    });
    expect(parseSesNotification(JSON.stringify({ eventType: "Bounce", mail, bounce: { bounceType: "Permanent" } }))?.status).toBe("BOUNCED");
    expect(parseSesNotification(JSON.stringify({ eventType: "Bounce", mail, bounce: { bounceType: "Transient" } }))?.status).toBeNull();
    expect(parseSesNotification(JSON.stringify({ notificationType: "Complaint", mail, complaint: {} }))?.status).toBe("COMPLAINT");
    expect(parseSesNotification("not json")).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  APPLICATION_STATUSES,
  STATUS_CONFIG,
  STATUS_TRANSITIONS,
  canTransition,
  getAllowedTransitions,
  isApplicationStatus,
  isTerminalStatus,
} from "@/lib/applications/status";
import { nextDeliveryStatus } from "@/lib/email/delivery-status";

describe("application status lifecycle", () => {
  it("defines config for every status", () => {
    expect(APPLICATION_STATUSES).toHaveLength(10);
    for (const s of APPLICATION_STATUSES) expect(STATUS_CONFIG[s].label).toBeTruthy();
  });

  it("follows the main pipeline", () => {
    expect(canTransition("DRAFT", "APPLIED")).toBe(true);
    expect(canTransition("APPLIED", "ACKNOWLEDGED")).toBe(true);
    expect(canTransition("ACKNOWLEDGED", "HR_SCREENING")).toBe(true);
    expect(canTransition("HR_SCREENING", "TECHNICAL_INTERVIEW")).toBe(true);
    expect(canTransition("TECHNICAL_INTERVIEW", "FINAL_INTERVIEW")).toBe(true);
    expect(canTransition("FINAL_INTERVIEW", "OFFER")).toBe(true);
  });

  it("allows skipping forward stages but not moving backwards", () => {
    expect(canTransition("APPLIED", "TECHNICAL_INTERVIEW")).toBe(true);
    expect(canTransition("FINAL_INTERVIEW", "HR_SCREENING")).toBe(false);
    expect(canTransition("OFFER", "APPLIED")).toBe(false);
  });

  it("does not allow a draft to jump into interviews", () => {
    expect(canTransition("DRAFT", "HR_SCREENING")).toBe(false);
    expect(canTransition("DRAFT", "REJECTED")).toBe(false);
  });

  it("allows Rejected / Withdrawn / No Response from submitted stages", () => {
    for (const from of ["APPLIED", "ACKNOWLEDGED", "HR_SCREENING", "TECHNICAL_INTERVIEW", "FINAL_INTERVIEW"] as const) {
      expect(canTransition(from, "REJECTED")).toBe(true);
      expect(canTransition(from, "WITHDRAWN")).toBe(true);
      expect(canTransition(from, "NO_RESPONSE")).toBe(true);
    }
    expect(canTransition("OFFER", "NO_RESPONSE")).toBe(false);
  });

  it("treats Rejected and Withdrawn as terminal, and allows re-opening No Response", () => {
    expect(isTerminalStatus("REJECTED")).toBe(true);
    expect(isTerminalStatus("WITHDRAWN")).toBe(true);
    expect(isTerminalStatus("NO_RESPONSE")).toBe(false);
    expect(canTransition("NO_RESPONSE", "HR_SCREENING")).toBe(true);
  });

  it("never lists a self-transition", () => {
    for (const s of APPLICATION_STATUSES) expect(STATUS_TRANSITIONS[s]).not.toContain(s);
    expect(getAllowedTransitions("DRAFT")).toEqual(["APPLIED", "WITHDRAWN"]);
  });

  it("validates unknown strings", () => {
    expect(isApplicationStatus("APPLIED")).toBe(true);
    expect(isApplicationStatus("Interview")).toBe(false);
  });
});

describe("email delivery status precedence", () => {
  it("moves forward only", () => {
    expect(nextDeliveryStatus("SENT", "DELIVERED")).toBe("DELIVERED");
    expect(nextDeliveryStatus("DELIVERED", "COMPLAINT")).toBe("COMPLAINT");
    expect(nextDeliveryStatus("COMPLAINT", "DELIVERED")).toBeNull();
    expect(nextDeliveryStatus("BOUNCED", "DELIVERED")).toBeNull();
    expect(nextDeliveryStatus("SENT", "SENT")).toBeNull();
  });

  it("ignores events for failed sends", () => {
    expect(nextDeliveryStatus("FAILED", "DELIVERED")).toBeNull();
  });
});

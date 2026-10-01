import { describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import {
  addApplicationNote,
  changeApplicationStatus,
  createApplication,
  deleteApplication,
  getApplication,
  listApplications,
  updateApplication,
} from "@/lib/applications/service";
import { DEFAULT_QUERY } from "@/lib/applications/query";
import type { ApplicationInput } from "@/lib/applications/schemas";

function input(overrides: Partial<ApplicationInput> = {}): ApplicationInput {
  return {
    company: "Veyrion",
    position: "Associate Software Engineer",
    dateApplied: new Date("2026-10-01T00:00:00Z"),
    location: "Colombo",
    jobUrl: null,
    source: "LINKEDIN",
    techStack: ["C#", ".NET", "React"],
    status: "DRAFT",
    notes: null,
    recipientEmail: "people@veyrion.example",
    cc: null,
    bcc: null,
    emailSubject: null,
    emailBody: null,
    documents: [],
    ...overrides,
  };
}

describe("creating applications", () => {
  it("assigns sequential human-readable IDs and records history + timeline", async () => {
    const a = await createApplication(input());
    const b = await createApplication(input({ company: "Rootcode" }));
    expect(a.applicationId).toBe("APP-0001");
    expect(b.applicationId).toBe("APP-0002");
    expect(a.id).not.toBe(a.applicationId); // internal CUID vs display ID

    const details = await getApplication(a.id);
    expect(details?.techStack.map((t) => t.name).sort()).toEqual([".NET", "C#", "React"]);
    expect(details?.statusHistory).toHaveLength(1);
    expect(details?.statusHistory[0]).toMatchObject({ fromStatus: null, toStatus: "DRAFT" });
    expect(details?.events.map((e) => e.eventType)).toEqual(["APPLICATION_CREATED"]);
  });

  it("allocates unique IDs under concurrency", async () => {
    const created = await Promise.all(Array.from({ length: 5 }, (_, i) => createApplication(input({ company: `C${i}` }))));
    const ids = created.map((c) => c.applicationId).sort();
    expect(new Set(ids).size).toBe(5);
    expect(ids).toEqual(["APP-0001", "APP-0002", "APP-0003", "APP-0004", "APP-0005"]);
  });

  it("rejects links to documents that do not exist", async () => {
    await expect(createApplication(input({ documents: [{ documentId: "missing", role: "CV" }] }))).rejects.toMatchObject({
      code: "VALIDATION",
    });
    expect(await db.application.count()).toBe(0);
  });
});

describe("updating status", () => {
  it("validates transitions and writes StatusHistory + STATUS_CHANGED events", async () => {
    const app = await createApplication(input());
    await changeApplicationStatus(app.id, "APPLIED");
    await changeApplicationStatus(app.id, "TECHNICAL_INTERVIEW", "Scheduled for Oct 8");

    await expect(changeApplicationStatus(app.id, "DRAFT")).rejects.toMatchObject({ code: "INVALID_TRANSITION" });

    const details = await getApplication(app.id);
    expect(details?.status).toBe("TECHNICAL_INTERVIEW");
    expect(details?.statusHistory.map((h) => `${h.fromStatus}->${h.toStatus}`)).toEqual([
      "APPLIED->TECHNICAL_INTERVIEW",
      "DRAFT->APPLIED",
      "null->DRAFT",
    ]);
    expect(details?.statusHistory[0].note).toBe("Scheduled for Oct 8");
    expect(details?.events.filter((e) => e.eventType === "STATUS_CHANGED")).toHaveLength(2);
  });

  it("is a no-op when the status does not change", async () => {
    const app = await createApplication(input());
    expect(await changeApplicationStatus(app.id, "DRAFT")).toEqual({ changed: false });
  });

  it("validates status changes made through the edit form", async () => {
    const app = await createApplication(input({ status: "REJECTED" }));
    await expect(updateApplication(app.id, input({ status: "OFFER" }))).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("records which fields changed and replaces the tech stack", async () => {
    const app = await createApplication(input());
    await updateApplication(app.id, input({ position: "Software Engineer", techStack: ["Go"], status: "APPLIED" }));
    const details = await getApplication(app.id);
    expect(details?.position).toBe("Software Engineer");
    expect(details?.techStack.map((t) => t.name)).toEqual(["Go"]);
    const updated = details?.events.find((e) => e.eventType === "APPLICATION_UPDATED");
    expect(updated?.metadata).toMatchObject({ fields: expect.arrayContaining(["position", "techStack"]) });
    expect(details?.status).toBe("APPLIED");
  });

  it("adds notes to the timeline", async () => {
    const app = await createApplication(input());
    await addApplicationNote(app.id, "Technical interview scheduled");
    const details = await getApplication(app.id);
    expect(details?.events[0]).toMatchObject({ eventType: "NOTE", description: "Technical interview scheduled" });
  });
});

describe("database operations", () => {
  it("cascades deletes to dependent rows", async () => {
    const app = await createApplication(input());
    await changeApplicationStatus(app.id, "APPLIED");
    await deleteApplication(app.id);
    expect(await db.application.count()).toBe(0);
    expect(await db.statusHistory.count()).toBe(0);
    expect(await db.applicationEvent.count()).toBe(0);
    expect(await db.applicationTechnology.count()).toBe(0);
    await expect(deleteApplication(app.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("searches, filters, sorts and paginates", async () => {
    await createApplication(input({ company: "Veyrion", position: "Associate SE", techStack: ["React"], dateApplied: new Date("2026-09-01T00:00:00Z") }));
    await createApplication(input({ company: "Rootcode", position: "Intern", techStack: ["Node.js"], location: "Remote", status: "APPLIED", source: "COMPANY_WEBSITE", dateApplied: new Date("2026-09-20T00:00:00Z") }));
    await createApplication(input({ company: "Acme", position: "DevOps", techStack: ["AWS"], dateApplied: null }));

    const bySearch = await listApplications({ ...DEFAULT_QUERY, q: "react" }); // case-insensitive tech match
    expect(bySearch.items.map((i) => i.company)).toEqual(["Veyrion"]);

    const byId = await listApplications({ ...DEFAULT_QUERY, q: "APP-0002" });
    expect(byId.items.map((i) => i.company)).toEqual(["Rootcode"]);

    const byStatus = await listApplications({ ...DEFAULT_QUERY, status: ["APPLIED"], source: ["COMPANY_WEBSITE"] });
    expect(byStatus.total).toBe(1);

    const byDate = await listApplications({ ...DEFAULT_QUERY, from: "2026-09-10", to: "2026-09-30" });
    expect(byDate.items.map((i) => i.company)).toEqual(["Rootcode"]);

    const byLocation = await listApplications({ ...DEFAULT_QUERY, location: "remote" });
    expect(byLocation.items.map((i) => i.company)).toEqual(["Rootcode"]);

    const sorted = await listApplications({ ...DEFAULT_QUERY, sort: "company", order: "asc" });
    expect(sorted.items.map((i) => i.company)).toEqual(["Acme", "Rootcode", "Veyrion"]);

    const byDateDesc = await listApplications({ ...DEFAULT_QUERY });
    expect(byDateDesc.items.map((i) => i.company)).toEqual(["Rootcode", "Veyrion", "Acme"]); // nulls last

    const page2 = await listApplications({ ...DEFAULT_QUERY, sort: "company", order: "asc", pageSize: 2, page: 2 } as typeof DEFAULT_QUERY);
    expect(page2.items.map((i) => i.company)).toEqual(["Veyrion"]);
    expect(page2.pageCount).toBe(2);
  });
});

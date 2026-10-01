/**
 * Seed data for local development (`npx prisma db seed`).
 *
 * Idempotent: templates are upserted by name, the profile by id, and sample
 * applications are created only when the database has no applications yet.
 * Never run against production unless you want sample data there.
 * See docs/database/migrations.md#seeding.
 */
import "dotenv/config";
import { createPrismaClient } from "../lib/prisma-client";
import type { ApplicationSource, ApplicationStatus } from "../lib/generated/prisma/enums";
import { formatApplicationId } from "../lib/applications/application-id";

const prisma = createPrismaClient();

const TEMPLATES = [
  {
    name: "General application",
    subject: "Application for {{position}} at {{company}}",
    body: `Dear Hiring Team,

I am writing to apply for the {{position}} position at {{company}}.

Please find my CV attached for your consideration. I would welcome the opportunity to discuss how my experience can contribute to your team.

Best regards,
{{name}}
{{email}} | {{phone}}`,
  },
  {
    name: "Internship application",
    subject: "Internship application — {{position}}",
    body: `Dear Hiring Team,

I am excited to apply for the {{position}} internship at {{company}} in {{location}}.

My CV is attached. Thank you for your time and consideration.

Kind regards,
{{name}}
{{phone}}`,
  },
];

const SAMPLE_APPLICATIONS: {
  company: string;
  position: string;
  techStack: string[];
  location: string;
  status: ApplicationStatus;
  source: ApplicationSource;
  daysAgo: number;
}[] = [
  { company: "Veyrion", position: "Associate Software Engineer", techStack: ["C#", ".NET", "React"], location: "Colombo", status: "APPLIED", source: "LINKEDIN", daysAgo: 0 },
  { company: "Rootcode", position: "Software Engineer Intern", techStack: ["React", "Node.js"], location: "Remote", status: "TECHNICAL_INTERVIEW", source: "COMPANY_WEBSITE", daysAgo: 1 },
  { company: "Northwind Labs", position: "Backend Developer", techStack: ["Node.js", "PostgreSQL", "AWS"], location: "Colombo", status: "HR_SCREENING", source: "REFERRAL", daysAgo: 12 },
  { company: "Acme Cloud", position: "DevOps Engineer", techStack: ["AWS", "Terraform", "Docker"], location: "Remote", status: "REJECTED", source: "JOB_BOARD", daysAgo: 35 },
  { company: "Blue Harbor", position: "Full Stack Developer", techStack: ["React", "Next.js", "TypeScript"], location: "Kandy", status: "NO_RESPONSE", source: "LINKEDIN", daysAgo: 60 },
  { company: "Lumen Systems", position: ".NET Developer", techStack: ["C#", ".NET", "SQL Server"], location: "Colombo", status: "DRAFT", source: "RECRUITER", daysAgo: 2 },
];

async function main() {
  for (const t of TEMPLATES) {
    await prisma.emailTemplate.upsert({ where: { name: t.name }, create: t, update: {} });
  }
  await prisma.profile.upsert({
    where: { id: "default" },
    create: { id: "default", fullName: "Your Name", email: "you@example.com", phone: "+94 77 000 0000", location: "Colombo" },
    update: {},
  });

  const existing = await prisma.application.count();
  if (existing > 0) {
    console.log(`Seed: ${existing} applications already exist — skipping sample applications.`);
    return;
  }

  for (const sample of SAMPLE_APPLICATIONS) {
    await prisma.$transaction(async (tx) => {
      const counter = await tx.counter.upsert({
        where: { name: "application" },
        create: { name: "application", value: 1 },
        update: { value: { increment: 1 } },
      });
      const date = new Date(Date.now() - sample.daysAgo * 86_400_000);
      const dateApplied = sample.status === "DRAFT" ? null : new Date(`${date.toISOString().slice(0, 10)}T00:00:00Z`);
      const app = await tx.application.create({
        data: {
          applicationId: formatApplicationId(counter.value),
          company: sample.company,
          position: sample.position,
          location: sample.location,
          status: sample.status,
          source: sample.source,
          dateApplied,
          techStack: { create: sample.techStack.map((name) => ({ name })) },
          statusHistory: { create: { fromStatus: null, toStatus: sample.status, note: "Seed data" } },
        },
      });
      await tx.applicationEvent.create({
        data: { applicationId: app.id, eventType: "APPLICATION_CREATED", description: `Application ${app.applicationId} created (seed)` },
      });
    });
  }
  console.log(`Seed: created ${SAMPLE_APPLICATIONS.length} sample applications, ${TEMPLATES.length} templates.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

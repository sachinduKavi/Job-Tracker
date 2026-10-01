import { createPrismaClient } from "../../lib/prisma-client";

/** Children before parents so foreign keys are never violated. */
const TABLES = [
  "EmailAttachment",
  "Email",
  "ApplicationDocument",
  "ApplicationTechnology",
  "StatusHistory",
  "ApplicationEvent",
  "Application",
  "Document",
  "EmailTemplate",
  "Profile",
  "Counter",
];

/** Empties every table (test database only — guarded by loadTestEnv). */
export async function resetDatabase() {
  const prisma = createPrismaClient();
  try {
    for (const table of TABLES) await prisma.$executeRawUnsafe(`DELETE FROM \`${table}\``);
  } finally {
    await prisma.$disconnect();
  }
}

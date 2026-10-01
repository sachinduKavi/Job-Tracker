import "server-only";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { Prisma } from "@/lib/generated/prisma/client";
import type { TemplateFormValues } from "@/lib/templates/schemas";

/** Email template CRUD. See docs/features/email-templates.md. */

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

const duplicateName = () =>
  new AppError("CONFLICT", "A template with this name already exists", { name: "Name must be unique" });

export async function listTemplates() {
  return db.emailTemplate.findMany({ orderBy: { name: "asc" } });
}

export async function getTemplate(id: string) {
  return db.emailTemplate.findUnique({ where: { id } });
}

export async function createTemplate(values: TemplateFormValues) {
  try {
    return await db.emailTemplate.create({ data: values });
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateName();
    throw error;
  }
}

export async function updateTemplate(id: string, values: TemplateFormValues) {
  const exists = await db.emailTemplate.count({ where: { id } });
  if (!exists) throw new AppError("NOT_FOUND", "Template not found");
  try {
    return await db.emailTemplate.update({ where: { id }, data: values });
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateName();
    throw error;
  }
}

export async function deleteTemplate(id: string) {
  const exists = await db.emailTemplate.count({ where: { id } });
  if (!exists) throw new AppError("NOT_FOUND", "Template not found");
  await db.emailTemplate.delete({ where: { id } });
}

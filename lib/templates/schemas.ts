import { z } from "zod";
import { requiredText } from "@/lib/validation/common";

export const templateFormSchema = z.object({
  name: requiredText("Name", 120),
  subject: requiredText("Subject", 500),
  body: requiredText("Body", 20_000),
});

export type TemplateFormValues = z.infer<typeof templateFormSchema>;

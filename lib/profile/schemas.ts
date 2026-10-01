import { z } from "zod";
import { optionalEmail, optionalText } from "@/lib/validation/common";

/** Applicant profile form (client + server). */
export const profileSchema = z.object({
  fullName: optionalText(200),
  email: optionalEmail,
  phone: optionalText(50),
  location: optionalText(200),
});

export type ProfileValues = z.infer<typeof profileSchema>;

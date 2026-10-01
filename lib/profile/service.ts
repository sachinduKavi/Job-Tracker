import "server-only";
import { db } from "@/lib/db";
import type { ProfileValues } from "@/lib/profile/schemas";

/** Applicant profile (single row) that feeds {{name}}, {{email}}, {{phone}} template variables. */


const PROFILE_ID = "default";

export async function getProfile(): Promise<ProfileValues> {
  const profile = await db.profile.findUnique({ where: { id: PROFILE_ID } });
  return {
    fullName: profile?.fullName ?? "",
    email: profile?.email ?? "",
    phone: profile?.phone ?? "",
    location: profile?.location ?? "",
  };
}

export async function updateProfile(values: ProfileValues) {
  return db.profile.upsert({
    where: { id: PROFILE_ID },
    create: { id: PROFILE_ID, ...values },
    update: values,
  });
}

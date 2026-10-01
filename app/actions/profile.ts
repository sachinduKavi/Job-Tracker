"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/actions/run-action";
import { AppError } from "@/lib/errors";
import { profileSchema } from "@/lib/profile/schemas";
import { updateProfile } from "@/lib/profile/service";
import { toFieldErrors } from "@/lib/validation/common";

export async function updateProfileAction(values: unknown) {
  return runAction("updateProfile", async () => {
    const parsed = profileSchema.safeParse(values);
    if (!parsed.success) throw new AppError("VALIDATION", "Please fix the highlighted fields", toFieldErrors(parsed.error));
    await updateProfile(parsed.data);
    revalidatePath("/settings");
    return { ok: true as const, data: undefined, message: "Profile saved" };
  });
}

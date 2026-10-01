"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateProfileAction } from "@/app/actions/profile";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { profileSchema as schema, type ProfileValues as Values } from "@/lib/profile/schemas";

export function ProfileForm({ defaultValues }: { defaultValues: Values }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema), defaultValues });
  const e = formState.errors;

  return (
    <form
      noValidate
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={handleSubmit((values) =>
        startTransition(async () => {
          const result = await updateProfileAction(values);
          if (result.ok) {
            toast.success(result.message);
            router.refresh();
          } else toast.error(result.error);
        }),
      )}
    >
      <Field label="Full name ({{name}})" htmlFor="p-name" error={e.fullName?.message}>
        <Input id="p-name" {...register("fullName")} />
      </Field>
      <Field label="Email ({{email}})" htmlFor="p-email" error={e.email?.message}>
        <Input id="p-email" type="email" {...register("email")} />
      </Field>
      <Field label="Phone ({{phone}})" htmlFor="p-phone" error={e.phone?.message}>
        <Input id="p-phone" {...register("phone")} />
      </Field>
      <Field label="Your location" htmlFor="p-location" error={e.location?.message} hint="Informational; {{location}} uses the job location.">
        <Input id="p-location" {...register("location")} />
      </Field>
      <div className="sm:col-span-2 flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Save profile
        </Button>
      </div>
    </form>
  );
}

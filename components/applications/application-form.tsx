"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createApplicationAction, updateApplicationAction } from "@/app/actions/applications";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { applicationFormSchema, type ApplicationFormValues } from "@/lib/applications/schemas";
import { APPLICATION_SOURCES, SOURCE_LABELS } from "@/lib/applications/source";
import {
  APPLICATION_STATUSES,
  STATUS_CONFIG,
  getAllowedTransitions,
  type ApplicationStatus,
} from "@/lib/applications/status";
import { DOCUMENT_TYPE_LABELS } from "@/lib/documents/validation";
import type { DocumentType } from "@/lib/generated/prisma/enums";
import { renderEmailTemplate, type TemplateValues } from "@/lib/templates/render";

export interface FormDocumentOption {
  id: string;
  name: string;
  type: DocumentType;
  isDefault: boolean;
}

export interface FormTemplateOption {
  id: string;
  name: string;
  subject: string;
  body: string;
}

const NONE = "__none__";

/**
 * Create / edit form. Validation: Zod schema on the client (instant feedback) and the
 * same schema again inside the Server Action (authoritative).
 */
export function ApplicationForm({
  mode,
  applicationId,
  initialStatus,
  defaultValues,
  documents,
  templates,
  profile,
}: {
  mode: "create" | "edit";
  applicationId?: string;
  initialStatus?: ApplicationStatus;
  defaultValues: ApplicationFormValues;
  documents: FormDocumentOption[];
  templates: FormTemplateOption[];
  profile: TemplateValues;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const form = useForm<ApplicationFormValues>({
    resolver: zodResolver(applicationFormSchema),
    defaultValues,
    mode: "onBlur",
  });
  const { register, control, handleSubmit, formState, setError, setValue, getValues } = form;
  const errors = formState.errors;

  const statusOptions: readonly ApplicationStatus[] =
    mode === "edit" && initialStatus ? [initialStatus, ...getAllowedTransitions(initialStatus)] : APPLICATION_STATUSES;
  const cvs = documents.filter((d) => d.type === "CV");
  const coverLetters = documents.filter((d) => d.type === "COVER_LETTER");
  const cvId = useWatch({ control, name: "cvId" });
  const coverLetterId = useWatch({ control, name: "coverLetterId" });
  const additionalCandidates = documents.filter((d) => d.id !== cvId && d.id !== coverLetterId);

  function applyTemplate(templateId: string) {
    const template = templates.find((t) => t.id === templateId);
    if (!template) return;
    const values = getValues();
    const rendered = renderEmailTemplate(template, {
      ...profile,
      company: values.company,
      position: values.position,
      location: values.location,
    });
    setValue("emailSubject", rendered.subject, { shouldDirty: true });
    setValue("emailBody", rendered.body, { shouldDirty: true });
    if (rendered.missing.length) toast.warning(`Template variables without a value: ${rendered.missing.join(", ")}`);
  }

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result =
        mode === "create" ? await createApplicationAction(values) : await updateApplicationAction(applicationId!, values);
      if (!result.ok) {
        for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
          setError(field as keyof ApplicationFormValues, { message });
        }
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      router.push(`/applications/${result.data.id}`);
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle>Basic information</CardTitle>
          <CardDescription>Company, role and where you found it.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name" htmlFor="company" error={errors.company?.message} required>
            <Input id="company" {...register("company")} aria-invalid={!!errors.company} />
          </Field>
          <Field label="Position" htmlFor="position" error={errors.position?.message} required>
            <Input id="position" {...register("position")} aria-invalid={!!errors.position} />
          </Field>
          <Field label="Application date" htmlFor="dateApplied" error={errors.dateApplied?.message} hint="Set automatically when the email is sent, if empty.">
            <Input id="dateApplied" type="date" {...register("dateApplied")} />
          </Field>
          <Field label="Location" htmlFor="location" error={errors.location?.message}>
            <Input id="location" placeholder="Colombo, Remote…" {...register("location")} />
          </Field>
          <Field label="Job URL" htmlFor="jobUrl" error={errors.jobUrl?.message}>
            <Input id="jobUrl" type="url" placeholder="https://…" {...register("jobUrl")} />
          </Field>
          <Field label="Source" htmlFor="source" error={errors.source?.message}>
            <Controller
              control={control}
              name="source"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="source" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPLICATION_SOURCES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SOURCE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Tech stack" htmlFor="techStack" error={errors.techStack?.message} hint="Comma-separated, e.g. C#, .NET, React">
            <Input id="techStack" {...register("techStack")} />
          </Field>
          <Field label="Status" htmlFor="status" error={errors.status?.message}>
            <Controller
              control={control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="status" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUS_CONFIG[s].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Notes" htmlFor="notes" error={errors.notes?.message} className="sm:col-span-2">
            <Textarea id="notes" rows={3} {...register("notes")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
          <CardDescription>
            Saved as a draft for the composer. Nothing is sent until you confirm in the composer.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Recipient email" htmlFor="recipientEmail" error={errors.recipientEmail?.message} className="sm:col-span-2">
            <Input id="recipientEmail" type="email" placeholder="careers@company.com" {...register("recipientEmail")} />
          </Field>
          <Field label="CC" htmlFor="cc" error={errors.cc?.message} hint="Comma-separated">
            <Input id="cc" {...register("cc")} />
          </Field>
          <Field label="BCC" htmlFor="bcc" error={errors.bcc?.message} hint="Comma-separated">
            <Input id="bcc" {...register("bcc")} />
          </Field>
          {templates.length > 0 ? (
            <Field label="Fill from template" htmlFor="template" className="sm:col-span-2" hint="Uses the company, position and location entered above.">
              <Select onValueChange={applyTemplate}>
                <SelectTrigger id="template" className="w-full">
                  <SelectValue placeholder="Choose a template…" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : null}
          <Field label="Email subject" htmlFor="emailSubject" error={errors.emailSubject?.message} className="sm:col-span-2">
            <Input id="emailSubject" {...register("emailSubject")} />
          </Field>
          <Field label="Email body" htmlFor="emailBody" error={errors.emailBody?.message} className="sm:col-span-2">
            <Textarea id="emailBody" rows={8} {...register("emailBody")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Documents</CardTitle>
          <CardDescription>
            Pick from your document library. <Link href="/documents" className="text-primary hover:underline">Manage documents</Link>
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="CV" htmlFor="cvId" error={errors.cvId?.message}>
            <Controller
              control={control}
              name="cvId"
              render={({ field }) => (
                <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                  <SelectTrigger id="cvId" className="w-full" data-testid="cv-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No CV</SelectItem>
                    {cvs.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                        {d.isDefault ? " (default)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field label="Cover letter" htmlFor="coverLetterId" error={errors.coverLetterId?.message}>
            <Controller
              control={control}
              name="coverLetterId"
              render={({ field }) => (
                <Select value={field.value || NONE} onValueChange={(v) => field.onChange(v === NONE ? "" : v)}>
                  <SelectTrigger id="coverLetterId" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>No cover letter</SelectItem>
                    {coverLetters.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                        {d.isDefault ? " (default)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <div className="grid gap-2 sm:col-span-2">
            <span className="text-sm font-medium">Additional documents</span>
            {additionalCandidates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No other documents in your library.</p>
            ) : (
              <Controller
                control={control}
                name="additionalDocumentIds"
                render={({ field }) => (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {additionalCandidates.map((d) => {
                      const checked = field.value.includes(d.id);
                      return (
                        <label key={d.id} className="flex items-center gap-2 rounded-lg border p-2.5 text-sm">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(c) =>
                              field.onChange(c === true ? [...field.value, d.id] : field.value.filter((id) => id !== d.id))
                            }
                          />
                          <span className="truncate">{d.name}</span>
                          <span className="ml-auto text-xs text-muted-foreground">{DOCUMENT_TYPE_LABELS[d.type]}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {mode === "create" ? "Create application" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

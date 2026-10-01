"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveTemplateAction } from "@/app/actions/templates";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TEMPLATE_VARIABLES, renderEmailTemplate, type TemplateValues } from "@/lib/templates/render";
import { templateFormSchema, type TemplateFormValues } from "@/lib/templates/schemas";

export function TemplateDialog({
  open,
  onOpenChange,
  template,
  sampleValues,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: ({ id: string } & TemplateFormValues) | null;
  sampleValues: TemplateValues;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const form = useForm<TemplateFormValues>({
    resolver: zodResolver(templateFormSchema),
    values: template ? { name: template.name, subject: template.subject, body: template.body } : { name: "", subject: "", body: "" },
  });
  const { register, handleSubmit, formState, setError, getValues, setValue, control } = form;
  const [subject, body] = useWatch({ control, name: ["subject", "body"] });
  const preview = renderEmailTemplate({ subject, body }, sampleValues);
  const bodyField = register("body");

  function insertVariable(key: string) {
    const el = bodyRef.current;
    const token = `{{${key}}}`;
    const current = getValues("body");
    if (!el) return setValue("body", current + token, { shouldDirty: true });
    const start = el.selectionStart ?? current.length;
    const end = el.selectionEnd ?? current.length;
    setValue("body", current.slice(0, start) + token + current.slice(end), { shouldDirty: true });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  const onSubmit = handleSubmit((values) => {
    startTransition(async () => {
      const result = await saveTemplateAction(template?.id ?? null, values);
      if (!result.ok) {
        for (const [f, m] of Object.entries(result.fieldErrors ?? {})) setError(f as keyof TemplateFormValues, { message: m });
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      onOpenChange(false);
      router.refresh();
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{template ? "Edit template" : "New template"}</DialogTitle>
          <DialogDescription>Write in plain text. Variables are replaced when the template is used.</DialogDescription>
        </DialogHeader>
        <form id="template-form" onSubmit={onSubmit} className="grid gap-6 md:grid-cols-2" noValidate>
          <div className="grid content-start gap-4">
            <Field label="Name" htmlFor="t-name" error={formState.errors.name?.message} required>
              <Input id="t-name" {...register("name")} placeholder="General application" />
            </Field>
            <Field label="Subject" htmlFor="t-subject" error={formState.errors.subject?.message} required>
              <Input id="t-subject" {...register("subject")} placeholder="Application for {{position}} at {{company}}" />
            </Field>
            <Field label="Body" htmlFor="t-body" error={formState.errors.body?.message} required>
              <Textarea
                id="t-body"
                rows={12}
                {...bodyField}
                ref={(el) => {
                  bodyField.ref(el);
                  bodyRef.current = el;
                }}
              />
            </Field>
            <div className="flex flex-wrap gap-1.5">
              {TEMPLATE_VARIABLES.map((v) => (
                <Button key={v.key} type="button" variant="outline" size="xs" title={v.description} onClick={() => insertVariable(v.key)}>
                  {`{{${v.key}}}`}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid content-start gap-2">
            <span className="text-sm font-medium">Preview (sample values)</span>
            <div className="rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="mb-3 font-medium">{preview.subject || "(no subject)"}</p>
              <p className="whitespace-pre-wrap">{preview.body}</p>
            </div>
            {preview.unknown.length ? (
              <p className="text-xs text-amber-600">Unknown variables: {preview.unknown.join(", ")}</p>
            ) : null}
            {preview.missing.length ? (
              <p className="text-xs text-muted-foreground">
                No sample value for: {preview.missing.join(", ")} (set your profile in Settings)
              </p>
            ) : null}
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" form="template-form" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {template ? "Save template" : "Create template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Eye, FileText, Loader2, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";
import { sendEmailAction } from "@/app/actions/email";
import { EmailHtmlPreview } from "@/components/email/email-html-preview";
import { Field } from "@/components/shared/field";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { DOCUMENT_TYPE_LABELS, formatFileSize } from "@/lib/documents/validation";
import { htmlToText, textToHtml } from "@/lib/email/content";
import { MAX_TOTAL_ATTACHMENT_BYTES, composeEmailSchema, type ComposeEmailValues } from "@/lib/email/schemas";
import type { DocumentType } from "@/lib/generated/prisma/enums";
import { renderEmailTemplate, type TemplateValues } from "@/lib/templates/render";
import { parseEmailList } from "@/lib/validation/common";

export interface ComposerProps {
  application: {
    id: string;
    applicationId: string;
    company: string;
    position: string;
    location: string | null;
  };
  defaults: { to: string; cc: string; bcc: string; subject: string; message: string; documentIds: string[] };
  documents: { id: string; name: string; type: DocumentType; size: number; originalFilename: string }[];
  templates: { id: string; name: string; subject: string; body: string }[];
  profile: TemplateValues;
  sender: string;
}

function newKey() {
  return crypto.randomUUID().replace(/-/g, "");
}

/**
 * Email composer. The body is written as plain text (converted to simple HTML) or as
 * raw HTML. Sending requires an explicit confirmation dialog; the server re-validates,
 * sanitizes the HTML, enforces rate limits and blocks duplicate sends.
 */
export function EmailComposer({ application, defaults, documents, templates, profile, sender }: ComposerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [htmlMode, setHtmlMode] = useState(false);
  const [message, setMessage] = useState(defaults.message);
  const [customText, setCustomText] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [resendWarning, setResendWarning] = useState<string | null>(null);

  const form = useForm<ComposeEmailValues>({
    resolver: zodResolver(composeEmailSchema),
    defaultValues: {
      applicationId: application.id,
      to: defaults.to,
      cc: defaults.cc,
      bcc: defaults.bcc,
      subject: defaults.subject,
      html: textToHtml(defaults.message),
      text: defaults.message,
      documentIds: defaults.documentIds,
      idempotencyKey: newKey(),
      allowResend: false,
    },
  });
  const { register, control, formState, setValue, getValues, handleSubmit, setError } = form;
  const errors = formState.errors;
  const [html, text, documentIds, subject, to, ccRaw, bccRaw] = useWatch({
    control,
    name: ["html", "text", "documentIds", "subject", "to", "cc", "bcc"],
  });
  const cc = parseEmailList(ccRaw);
  const bcc = parseEmailList(bccRaw);
  const selectedDocs = documents.filter((d) => documentIds.includes(d.id));
  const totalSize = selectedDocs.reduce((s, d) => s + d.size, 0);

  function syncFromMessage(next: string) {
    setMessage(next);
    if (!htmlMode) setValue("html", textToHtml(next), { shouldValidate: formState.isSubmitted });
    if (!customText) setValue("text", next);
  }

  function setHtml(next: string) {
    setValue("html", next, { shouldValidate: formState.isSubmitted });
    if (!customText) setValue("text", htmlToText(next));
  }

  function applyTemplate(id: string) {
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    const rendered = renderEmailTemplate(template, {
      ...profile,
      company: application.company,
      position: application.position,
      location: application.location,
    });
    setValue("subject", rendered.subject, { shouldValidate: formState.isSubmitted });
    setHtmlMode(false);
    syncFromMessage(rendered.body);
    setValue("html", textToHtml(rendered.body));
    if (rendered.missing.length) {
      toast.warning(`No value for: ${rendered.missing.map((m) => `{{${m}}}`).join(", ")} — set them in Settings or edit the text.`);
    }
    if (rendered.unknown.length) toast.warning(`Unknown variables left as-is: ${rendered.unknown.join(", ")}`);
  }

  const openConfirm = handleSubmit(() => {
    if (totalSize > MAX_TOTAL_ATTACHMENT_BYTES) {
      toast.error("Attachments exceed the 15 MB total limit");
      return;
    }
    setConfirmOpen(true);
  });

  function send() {
    const values = getValues();
    startTransition(async () => {
      const result = await sendEmailAction(values);
      if (result.ok) {
        toast.success(result.message, {
          description: result.data.sesMessageId ? `SES Message ID: ${result.data.sesMessageId}` : undefined,
        });
        setConfirmOpen(false);
        router.push(`/applications/${application.id}`);
        router.refresh();
        return;
      }
      if (result.code === "DUPLICATE_SEND" && !values.allowResend && /already emailed/.test(result.error)) {
        setResendWarning(result.error);
        setValue("allowResend", true);
        return; // keep the dialog open; the user must confirm again
      }
      // A failed attempt consumes its idempotency key; a retry needs a fresh one.
      setValue("idempotencyKey", newKey());
      for (const [field, msg] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as keyof ComposeEmailValues, { message: msg });
      }
      setConfirmOpen(false);
      toast.error(result.error);
    });
  }


  return (
    <form onSubmit={openConfirm} className="grid gap-6 lg:grid-cols-5" noValidate>
      <div className="space-y-6 lg:col-span-3">
        <Card>
          <CardHeader>
            <CardTitle>Message</CardTitle>
            <CardDescription>From: {sender}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {templates.length ? (
              <Field label="Template" htmlFor="template">
                <Select onValueChange={applyTemplate}>
                  <SelectTrigger id="template" className="w-full" data-testid="template-select">
                    <SelectValue placeholder="Start from a template…" />
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
            <Field label="To" htmlFor="to" error={errors.to?.message} required>
              <Input id="to" type="email" {...register("to")} aria-invalid={!!errors.to} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="CC" htmlFor="cc" error={errors.cc?.message}>
                <Input id="cc" {...register("cc")} placeholder="Comma-separated" />
              </Field>
              <Field label="BCC" htmlFor="bcc" error={errors.bcc?.message}>
                <Input id="bcc" {...register("bcc")} placeholder="Comma-separated" />
              </Field>
            </div>
            <Field label="Subject" htmlFor="subject" error={errors.subject?.message} required>
              <Input id="subject" {...register("subject")} aria-invalid={!!errors.subject} />
            </Field>

            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="html-mode">Edit HTML directly</Label>
              <Switch
                id="html-mode"
                checked={htmlMode}
                onCheckedChange={(on) => {
                  setHtmlMode(on);
                  if (!on) setHtml(textToHtml(message));
                }}
              />
            </div>
            {htmlMode ? (
              <Field label="HTML body" htmlFor="html" error={errors.html?.message} hint="Scripts, styles and unsafe links are removed before sending.">
                <Textarea id="html" rows={14} className="font-mono text-xs" value={html} onChange={(e) => setHtml(e.target.value)} />
              </Field>
            ) : (
              <Field label="Body" htmlFor="message" error={errors.html?.message} required hint="Blank lines become paragraphs; URLs become links.">
                <Textarea id="message" rows={14} value={message} onChange={(e) => syncFromMessage(e.target.value)} />
              </Field>
            )}

            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="custom-text">Custom plain-text version</Label>
              <Switch
                id="custom-text"
                checked={customText}
                onCheckedChange={(on) => {
                  setCustomText(on);
                  if (!on) setValue("text", htmlMode ? htmlToText(html) : message);
                }}
              />
            </div>
            {customText ? (
              <Field label="Plain-text fallback" htmlFor="text" error={errors.text?.message}>
                <Textarea id="text" rows={8} {...register("text")} />
              </Field>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Paperclip className="size-4" /> Attachments
            </CardTitle>
            <CardDescription>
              {selectedDocs.length} selected · {formatFileSize(totalSize)} of 15 MB
            </CardDescription>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Upload a CV on the Documents page to attach it.</p>
            ) : (
              <Controller
                control={control}
                name="documentIds"
                render={({ field }) => (
                  <div className="grid gap-2">
                    {documents.map((d) => (
                      <label key={d.id} className="flex items-center gap-3 rounded-lg border p-2.5 text-sm has-[[data-state=checked]]:border-primary/50 has-[[data-state=checked]]:bg-primary/5">
                        <Checkbox
                          checked={field.value.includes(d.id)}
                          data-testid={`attach-${d.id}`}
                          onCheckedChange={(c) =>
                            field.onChange(c === true ? [...field.value, d.id] : field.value.filter((x) => x !== d.id))
                          }
                        />
                        <FileText className="size-4 text-muted-foreground" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{d.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {DOCUMENT_TYPE_LABELS[d.type]} · {d.originalFilename} · {formatFileSize(d.size)}
                          </span>
                        </span>
                      </label>
                    ))}
                    {errors.documentIds ? <p className="text-xs text-destructive">{errors.documentIds.message}</p> : null}
                  </div>
                )}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="size-4" /> Preview
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="html">
              <TabsList>
                <TabsTrigger value="html">HTML</TabsTrigger>
                <TabsTrigger value="text">Plain text</TabsTrigger>
              </TabsList>
              <TabsContent value="html" className="pt-2">
                <p className="mb-2 text-sm font-medium">{subject || "(no subject)"}</p>
                <EmailHtmlPreview html={html} />
              </TabsContent>
              <TabsContent value="text" className="pt-2">
                <pre className="h-80 overflow-auto rounded-lg border bg-muted/30 p-3 text-xs whitespace-pre-wrap">{text}</pre>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" size="lg">
          <Send /> Review &amp; send
        </Button>
      </div>

      <AlertDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (pending) return;
          setConfirmOpen(open);
          if (!open) {
            setResendWarning(null);
            setValue("allowResend", false);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send application?</AlertDialogTitle>
            <AlertDialogDescription>Review the details below. This sends a real email.</AlertDialogDescription>
          </AlertDialogHeader>
          <dl className="grid gap-3 rounded-lg border bg-muted/30 p-4 text-sm" data-testid="send-confirmation">
            <div>
              <dt className="text-xs text-muted-foreground">Company</dt>
              <dd className="font-medium">{application.company}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Position</dt>
              <dd className="font-medium">{application.position}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">To</dt>
              <dd className="font-medium break-all">{to}</dd>
            </div>
            {cc.length ? (
              <div>
                <dt className="text-xs text-muted-foreground">CC</dt>
                <dd className="break-all">{cc.join(", ")}</dd>
              </div>
            ) : null}
            {bcc.length ? (
              <div>
                <dt className="text-xs text-muted-foreground">BCC</dt>
                <dd className="break-all">{bcc.join(", ")}</dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs text-muted-foreground">Attachment{selectedDocs.length === 1 ? "" : "s"}</dt>
              <dd>
                {selectedDocs.length ? (
                  <ul>
                    {selectedDocs.map((d) => (
                      <li key={d.id} className="font-medium">
                        {d.originalFilename}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-amber-600">No attachments</span>
                )}
              </dd>
            </div>
          </dl>
          {resendWarning ? (
            <div className="flex gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-300" role="alert">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{resendWarning}</span>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button onClick={send} disabled={pending} data-testid="confirm-send">
              {pending ? <Loader2 className="animate-spin" /> : <Send />}
              {resendWarning ? "Send again" : "Send Application"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}

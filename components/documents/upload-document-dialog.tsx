"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { uploadDocumentAction } from "@/app/actions/documents";
import { Field } from "@/components/shared/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ACCEPT_ATTRIBUTE,
  ALLOWED_FILE_TYPES,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABELS,
  MAX_DOCUMENT_SIZE_BYTES,
  MAX_DOCUMENT_SIZE_LABEL,
  getExtension,
} from "@/lib/documents/validation";
import type { DocumentType } from "@/lib/generated/prisma/enums";

/** Upload dialog. Size/extension are checked here for fast feedback; the server re-checks content. */
export function UploadDocumentDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<DocumentType>("CV");
  const [isDefault, setIsDefault] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFile(null);
    setName("");
    setType("CV");
    setIsDefault(false);
    setError(null);
  }

  function choose(f: File | null) {
    setError(null);
    setFile(f);
    if (!f) return;
    if (!ALLOWED_FILE_TYPES.some((t) => t.extensions.includes(getExtension(f.name)))) {
      setError(`Unsupported file type. Allowed: ${ALLOWED_FILE_TYPES.map((t) => t.label).join(", ")}`);
    } else if (f.size > MAX_DOCUMENT_SIZE_BYTES) {
      setError(`File is larger than ${MAX_DOCUMENT_SIZE_LABEL}`);
    }
    if (!name) setName(f.name.replace(/\.[^.]+$/, ""));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || error) return;
    const fd = new FormData();
    fd.set("file", file);
    fd.set("name", name);
    fd.set("type", type);
    fd.set("isDefault", String(isDefault));
    startTransition(async () => {
      const result = await uploadDocumentAction(fd);
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        reset();
        router.refresh();
      } else {
        setError(result.fieldErrors?.file ?? result.error);
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Upload /> Upload document
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>
            {ALLOWED_FILE_TYPES.map((t) => t.label).join(", ")} · max {MAX_DOCUMENT_SIZE_LABEL}
          </DialogDescription>
        </DialogHeader>
        <form id="upload-form" onSubmit={submit} className="grid gap-4">
          <Field label="File" htmlFor="doc-file" error={error ?? undefined} required>
            <Input
              id="doc-file"
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              onChange={(e) => choose(e.target.files?.[0] ?? null)}
            />
          </Field>
          <Field label="Name" htmlFor="doc-name" required>
            <Input id="doc-name" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} placeholder="Full Stack Developer CV" />
          </Field>
          <Field label="Type" htmlFor="doc-type">
            <Select value={type} onValueChange={(v) => setType(v as DocumentType)}>
              <SelectTrigger id="doc-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {DOCUMENT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-center gap-2">
            <Checkbox id="doc-default" checked={isDefault} onCheckedChange={(c) => setIsDefault(c === true)} />
            <Label htmlFor="doc-default">Use as default for this type</Label>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" form="upload-form" disabled={!file || !!error || !name.trim() || pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Upload />}
            Upload
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTemplateAction } from "@/app/actions/templates";
import { EmptyState } from "@/components/shared/empty-state";
import { TemplateDialog } from "@/components/templates/template-dialog";
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
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { renderEmailTemplate, type TemplateValues } from "@/lib/templates/render";

export interface TemplateItem {
  id: string;
  name: string;
  subject: string;
  body: string;
  updatedAt: string;
}

export function TemplatesManager({ templates, sampleValues }: { templates: TemplateItem[]; sampleValues: TemplateValues }) {
  const router = useRouter();
  const [editing, setEditing] = useState<TemplateItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState<TemplateItem | null>(null);
  const [pending, startTransition] = useTransition();

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus /> New template
        </Button>
      </div>
      {templates.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="No templates yet"
          description="Templates let you reuse application emails with {{company}}, {{position}} and other variables."
          action={
            <Button onClick={openNew}>
              <Plus /> Create template
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {templates.map((t) => {
            const preview = renderEmailTemplate(t, sampleValues);
            return (
              <Card key={t.id} data-testid="template-card">
                <CardHeader>
                  <CardTitle>{t.name}</CardTitle>
                  <CardDescription className="truncate">{t.subject}</CardDescription>
                  <CardAction className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${t.name}`}
                      onClick={() => {
                        setEditing(t);
                        setDialogOpen(true);
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${t.name}`} onClick={() => setDeleting(t)}>
                      <Trash2 />
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-5 text-sm whitespace-pre-wrap text-muted-foreground">{preview.body}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <TemplateDialog open={dialogOpen} onOpenChange={setDialogOpen} template={editing} sampleValues={sampleValues} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The template is removed. Emails already sent with it are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  if (!deleting) return;
                  const result = await deleteTemplateAction(deleting.id);
                  if (result.ok) {
                    toast.success(result.message);
                    setDeleting(null);
                    router.refresh();
                  } else toast.error(result.error);
                })
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : null}
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

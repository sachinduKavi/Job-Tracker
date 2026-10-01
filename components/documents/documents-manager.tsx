"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Loader2, MoreHorizontal, Pencil, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteDocumentAction, renameDocumentAction, setDefaultDocumentAction } from "@/app/actions/documents";
import { EmptyState } from "@/components/shared/empty-state";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { DOCUMENT_TYPES, DOCUMENT_TYPE_LABELS, formatFileSize } from "@/lib/documents/validation";
import type { DocumentType } from "@/lib/generated/prisma/enums";
import { formatDate } from "@/lib/format";

export interface DocumentItem {
  id: string;
  name: string;
  type: DocumentType;
  originalFilename: string;
  mimeType: string;
  size: number;
  isDefault: boolean;
  createdAt: string;
  applicationCount: number;
}

export function DocumentsManager({ documents }: { documents: DocumentItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState<DocumentItem | null>(null);
  const [newName, setNewName] = useState("");
  const [deleting, setDeleting] = useState<DocumentItem | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string; message?: string }>, after?: () => void) {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(result.message);
        after?.();
        router.refresh();
      } else toast.error(result.error);
    });
  }

  if (documents.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No documents yet"
        description="Upload your CVs and cover letters once, then attach them to any application email."
      />
    );
  }

  return (
    <div className="space-y-8">
      {DOCUMENT_TYPES.map((type) => {
        const docs = documents.filter((d) => d.type === type);
        if (docs.length === 0) return null;
        return (
          <section key={type} className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">{DOCUMENT_TYPE_LABELS[type]}</h2>
            <ul className="divide-y rounded-xl border bg-card">
              {docs.map((d) => (
                <li key={d.id} className="flex items-center gap-3 p-4" data-testid="document-row">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <FileText className="size-5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-medium">
                      {d.name}
                      {d.isDefault ? (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="size-3 fill-current" /> Default
                        </Badge>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {d.originalFilename} · {formatFileSize(d.size)} · uploaded {formatDate(d.createdAt)} · used in{" "}
                      {d.applicationCount} application{d.applicationCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${d.name}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <a href={`/api/documents/${d.id}/download${d.mimeType === "application/pdf" ? "?inline=1" : ""}`} target="_blank" rel="noopener">
                          <Download /> Open
                        </a>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => {
                          setRenaming(d);
                          setNewName(d.name);
                        }}
                      >
                        <Pencil /> Rename
                      </DropdownMenuItem>
                      {!d.isDefault ? (
                        <DropdownMenuItem onSelect={() => run(() => setDefaultDocumentAction(d.id))}>
                          <Star /> Set as default
                        </DropdownMenuItem>
                      ) : null}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(d)}>
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename document</DialogTitle>
          </DialogHeader>
          <form
            id="rename-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!renaming) return;
              run(() => renameDocumentAction({ id: renaming.id, name: newName }), () => setRenaming(null));
            }}
          >
            <Input value={newName} maxLength={200} onChange={(e) => setNewName(e.target.value)} aria-label="Document name" autoFocus />
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              Cancel
            </Button>
            <Button type="submit" form="rename-form" disabled={pending || !newName.trim()}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              The file is removed from storage and unlinked from {deleting?.applicationCount ?? 0} application(s). Sent
              emails keep a record of the attachment name.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => deleting && run(() => deleteDocumentAction(deleting.id), () => setDeleting(null))}
            >
              {pending ? <Loader2 className="animate-spin" /> : null}
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

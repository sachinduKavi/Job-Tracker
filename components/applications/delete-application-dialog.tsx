"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { deleteApplicationAction } from "@/app/actions/applications";
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

export function DeleteApplicationDialog({
  open,
  onOpenChange,
  application,
  redirectTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: { id: string; applicationId: string; company: string; position: string };
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function confirm() {
    startTransition(async () => {
      const result = await deleteApplicationAction(application.id);
      if (result.ok) {
        toast.success(`${application.applicationId} deleted`);
        onOpenChange(false);
        if (redirectTo) router.push(redirectTo);
        else router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {application.applicationId}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the application for <strong>{application.position}</strong> at{" "}
            <strong>{application.company}</strong>, including its email history, status history and timeline.
            Documents in your library are kept.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={confirm} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Delete application
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

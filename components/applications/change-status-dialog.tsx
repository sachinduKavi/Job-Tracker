"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { changeStatusAction } from "@/app/actions/applications";
import { StatusBadge } from "@/components/applications/status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { STATUS_CONFIG, getAllowedTransitions, type ApplicationStatus } from "@/lib/applications/status";

/** Only lifecycle-valid target statuses are offered (validated again on the server). */
export function ChangeStatusDialog({
  open,
  onOpenChange,
  application,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: { id: string; applicationId: string; status: ApplicationStatus };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const allowed = getAllowedTransitions(application.status);
  const [toStatus, setToStatus] = useState<ApplicationStatus | "">("");
  const [note, setNote] = useState("");

  function submit() {
    if (!toStatus) return;
    startTransition(async () => {
      const result = await changeStatusAction({ applicationId: application.id, toStatus, note });
      if (result.ok) {
        toast.success(result.message);
        onOpenChange(false);
        setToStatus("");
        setNote("");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change status — {application.applicationId}</DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            Current status: <StatusBadge status={application.status} />
          </DialogDescription>
        </DialogHeader>
        {allowed.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {STATUS_CONFIG[application.status].label} is a final status — no further changes are possible.
          </p>
        ) : (
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="to-status">New status</Label>
              <Select value={toStatus} onValueChange={(v) => setToStatus(v as ApplicationStatus)}>
                <SelectTrigger id="to-status" className="w-full">
                  <SelectValue placeholder="Select a status" />
                </SelectTrigger>
                <SelectContent>
                  {allowed.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_CONFIG[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="status-note">Note (optional)</Label>
              <Textarea
                id="status-note"
                value={note}
                maxLength={2000}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Technical interview scheduled for Oct 8"
              />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!toStatus || pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Update status
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

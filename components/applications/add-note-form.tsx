"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { addNoteAction } from "@/app/actions/applications";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/** Adds a free-form entry to the timeline (e.g. "Technical interview scheduled for Oct 8"). */
export function AddNoteForm({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!note.trim()) return;
        startTransition(async () => {
          const result = await addNoteAction({ applicationId, note });
          if (result.ok) {
            setNote("");
            toast.success(result.message);
            router.refresh();
          } else toast.error(result.error);
        });
      }}
    >
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={2000}
        rows={2}
        placeholder="Add a timeline note, e.g. Technical interview scheduled for Oct 8"
        aria-label="Timeline note"
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" variant="secondary" disabled={pending || !note.trim()}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          Add note
        </Button>
      </div>
    </form>
  );
}

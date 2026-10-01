"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, Mail, Pencil, Trash2 } from "lucide-react";
import { ChangeStatusDialog } from "@/components/applications/change-status-dialog";
import { DeleteApplicationDialog } from "@/components/applications/delete-application-dialog";
import type { RowApplication } from "@/components/applications/row-actions";
import { Button } from "@/components/ui/button";

export function DetailActions({ application }: { application: RowApplication }) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  return (
    <>
      <Button asChild>
        <Link href={`/applications/${application.id}/compose`}>
          <Mail /> Send email
        </Link>
      </Button>
      <Button variant="outline" onClick={() => setStatusOpen(true)}>
        <ArrowRightLeft /> Change status
      </Button>
      <Button asChild variant="outline">
        <Link href={`/applications/${application.id}/edit`}>
          <Pencil /> Edit
        </Link>
      </Button>
      <Button variant="ghost" className="text-destructive" onClick={() => setDeleteOpen(true)} aria-label="Delete application">
        <Trash2 />
      </Button>
      <ChangeStatusDialog open={statusOpen} onOpenChange={setStatusOpen} application={application} />
      <DeleteApplicationDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        application={application}
        redirectTo="/applications"
      />
    </>
  );
}

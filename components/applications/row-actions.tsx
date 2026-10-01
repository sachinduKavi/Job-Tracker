"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, Eye, Mail, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { ChangeStatusDialog } from "@/components/applications/change-status-dialog";
import { DeleteApplicationDialog } from "@/components/applications/delete-application-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ApplicationStatus } from "@/lib/applications/status";

export interface RowApplication {
  id: string;
  applicationId: string;
  company: string;
  position: string;
  status: ApplicationStatus;
}

/** Per-row actions: View, Edit, Send Email, Change Status, Delete. */
export function RowActions({ application }: { application: RowApplication }) {
  const [statusOpen, setStatusOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${application.applicationId}`}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem asChild>
            <Link href={`/applications/${application.id}`}>
              <Eye /> View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/applications/${application.id}/edit`}>
              <Pencil /> Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/applications/${application.id}/compose`}>
              <Mail /> Send email
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setStatusOpen(true)}>
            <ArrowRightLeft /> Change status
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2 /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ChangeStatusDialog open={statusOpen} onOpenChange={setStatusOpen} application={application} />
      <DeleteApplicationDialog open={deleteOpen} onOpenChange={setDeleteOpen} application={application} />
    </>
  );
}

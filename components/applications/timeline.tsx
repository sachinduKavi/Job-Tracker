import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCheck,
  FilePlus2,
  Files,
  Mail,
  MailX,
  MessageSquare,
  Pencil,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";
import type { ApplicationEventType } from "@/lib/generated/prisma/enums";
import { formatDateTime, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const EVENT_ICONS: Record<ApplicationEventType, { icon: LucideIcon; className: string }> = {
  APPLICATION_CREATED: { icon: FilePlus2, className: "bg-primary/10 text-primary" },
  APPLICATION_UPDATED: { icon: Pencil, className: "bg-muted text-muted-foreground" },
  STATUS_CHANGED: { icon: ArrowRightLeft, className: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  EMAIL_SENT: { icon: Mail, className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  EMAIL_FAILED: { icon: AlertTriangle, className: "bg-destructive/10 text-destructive" },
  EMAIL_DELIVERED: { icon: CheckCheck, className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  EMAIL_BOUNCED: { icon: MailX, className: "bg-destructive/10 text-destructive" },
  EMAIL_COMPLAINT: { icon: ShieldAlert, className: "bg-orange-500/10 text-orange-600" },
  DOCUMENTS_UPDATED: { icon: Files, className: "bg-muted text-muted-foreground" },
  NOTE: { icon: MessageSquare, className: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
};

export function Timeline({
  events,
}: {
  events: { id: string; eventType: ApplicationEventType; description: string; createdAt: Date }[];
}) {
  if (events.length === 0) return <p className="text-sm text-muted-foreground">No events yet.</p>;
  return (
    <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-border" data-testid="timeline">
      {events.map((event) => {
        const { icon: Icon, className } = EVENT_ICONS[event.eventType];
        return (
          <li key={event.id} className="relative flex gap-3">
            <span className={cn("z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card", className)}>
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 pt-1">
              <p className="text-sm break-words">{event.description}</p>
              <time className="text-xs text-muted-foreground" dateTime={event.createdAt.toISOString()} title={formatDateTime(event.createdAt)}>
                {formatShortDate(event.createdAt)} · {formatDateTime(event.createdAt).split(", ").pop()}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

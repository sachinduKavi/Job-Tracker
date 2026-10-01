import { STATUS_CONFIG, type ApplicationStatus } from "@/lib/applications/status";
import { EMAIL_STATUS_CONFIG, type EmailStatus } from "@/lib/email/delivery-status";
import { cn } from "@/lib/utils";

const BASE = "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap";

export function StatusBadge({ status, className }: { status: ApplicationStatus; className?: string }) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={cn(BASE, config.badgeClassName, className)} title={config.description}>
      {config.label}
    </span>
  );
}

export function EmailStatusBadge({ status, className }: { status: EmailStatus; className?: string }) {
  const config = EMAIL_STATUS_CONFIG[status];
  return (
    <span className={cn(BASE, config.badgeClassName, className)} title={config.description}>
      {config.label}
    </span>
  );
}

import Link from "next/link";
import { SearchX } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <EmptyState
      icon={SearchX}
      title="Not found"
      description="The page or record you are looking for does not exist or was deleted."
      action={
        <Button asChild variant="outline">
          <Link href="/applications">Back to applications</Link>
        </Button>
      }
    />
  );
}

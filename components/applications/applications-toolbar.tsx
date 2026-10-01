"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, Filter, Loader2, Search, X } from "lucide-react";
import { APPLICATION_SOURCES, SOURCE_LABELS } from "@/lib/applications/source";
import { APPLICATION_STATUSES, STATUS_CONFIG } from "@/lib/applications/status";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * Search + filter controls. All state is written to the URL (?q=&status=&source=...),
 * which re-renders the Server Component page with the new query. Changing any filter
 * resets pagination to page 1.
 */
const FILTER_KEYS = ["q", "status", "source", "company", "position", "location", "from", "to"];

export function ApplicationsToolbar({ locations }: { locations: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const list = (key: string) => (searchParams.get(key) ?? "").split(",").filter(Boolean);

  const debounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(debounce.current), []);

  function update(changes: Record<string, string | string[] | null>) {
    // Read the live URL (not the render-time snapshot) so rapid updates never overwrite each other.
    const params = new URLSearchParams(window.location.search);
    for (const [key, value] of Object.entries(changes)) {
      const v = Array.isArray(value) ? value.join(",") : value;
      if (v) params.set(key, v);
      else params.delete(key);
    }
    params.delete("page");
    startTransition(() => router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false }));
  }

  // Debounce free-text search; cancelled by "Clear".
  function onSearchChange(value: string) {
    setQ(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => update({ q: value.trim() || null }), 300);
  }

  const statuses = list("status");
  const sources = list("source");
  const active = FILTER_KEYS.some((k) => searchParams.get(k));
  const advancedCount = ["company", "position", "location", "from", "to"].filter((k) => searchParams.get(k)).length;

  function toggle(key: "status" | "source", current: string[], value: string, checked: boolean) {
    update({ [key]: checked ? [...current, value] : current.filter((v) => v !== value) });
  }

  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search company, position, tech, location or APP-ID…"
          className="pl-8"
          aria-label="Search applications"
        />
        {pending ? (
          <Loader2 className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" data-testid="status-filter">
              Status{statuses.length ? ` (${statuses.length})` : ""} <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Filter by status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {APPLICATION_STATUSES.map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={statuses.includes(s)}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(c) => toggle("status", statuses, s, c === true)}
              >
                {STATUS_CONFIG[s].label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Source{sources.length ? ` (${sources.length})` : ""} <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Filter by source</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {APPLICATION_SOURCES.map((s) => (
              <DropdownMenuCheckboxItem
                key={s}
                checked={sources.includes(s)}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(c) => toggle("source", sources, s, c === true)}
              >
                {SOURCE_LABELS[s]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <AdvancedFilters
          key={searchParams.toString()}
          initial={{
            company: searchParams.get("company") ?? "",
            position: searchParams.get("position") ?? "",
            location: searchParams.get("location") ?? "",
            from: searchParams.get("from") ?? "",
            to: searchParams.get("to") ?? "",
          }}
          count={advancedCount}
          locations={locations}
          onApply={(values) => update(values)}
        />

        {active ? (
          <Button
            variant="ghost"
            onClick={() => {
              clearTimeout(debounce.current);
              setQ("");
              update(Object.fromEntries(FILTER_KEYS.map((k) => [k, null])));
            }}
          >
            <X /> Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
}

type Advanced = { company: string; position: string; location: string; from: string; to: string };

function AdvancedFilters({
  initial,
  count,
  locations,
  onApply,
}: {
  initial: Advanced;
  count: number;
  locations: string[];
  onApply: (values: Advanced) => void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState(initial);
  const set = (key: keyof Advanced) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <Filter /> Filters{count ? ` (${count})` : ""}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            onApply(values);
            setOpen(false);
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="f-company">Company</Label>
            <Input id="f-company" value={values.company} onChange={set("company")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="f-position">Position</Label>
            <Input id="f-position" value={values.position} onChange={set("position")} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="f-location">Location</Label>
            <Input id="f-location" list="f-locations" value={values.location} onChange={set("location")} />
            <datalist id="f-locations">
              {locations.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="f-from">Applied from</Label>
              <Input id="f-from" type="date" value={values.from} onChange={set("from")} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="f-to">Applied to</Label>
              <Input id="f-to" type="date" value={values.to} onChange={set("to")} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setValues({ company: "", position: "", location: "", from: "", to: "" })}
            >
              Reset
            </Button>
            <Button type="submit">Apply</Button>
          </div>
        </form>
      </PopoverContent>
    </Popover>
  );
}

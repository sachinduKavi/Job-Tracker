/**
 * Email template variable substitution (pure, unit-tested, used on client and server).
 *
 * Syntax: `{{variable}}` with optional inner whitespace (`{{ company }}`).
 * Unknown variables are left untouched so typos are visible in the preview, and are
 * reported in `unknown`. Known variables with an empty value are reported in `missing`.
 * See docs/features/email-templates.md.
 */

export const TEMPLATE_VARIABLES = [
  { key: "company", description: "Company name from the application" },
  { key: "position", description: "Position / job title from the application" },
  { key: "name", description: "Your full name (Settings → Profile)" },
  { key: "email", description: "Your email address (Settings → Profile)" },
  { key: "phone", description: "Your phone number (Settings → Profile)" },
  { key: "location", description: "Job location from the application" },
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number]["key"];
export type TemplateValues = Partial<Record<TemplateVariable, string | null | undefined>>;

const KNOWN = new Set<string>(TEMPLATE_VARIABLES.map((v) => v.key));
const VARIABLE_PATTERN = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

export interface RenderResult {
  output: string;
  /** Known variables used in the template that have no value. */
  missing: TemplateVariable[];
  /** Variables used in the template that JobTrack does not know about. */
  unknown: string[];
}

export function extractVariables(template: string): string[] {
  const found = new Set<string>();
  for (const match of template.matchAll(VARIABLE_PATTERN)) found.add(match[1]);
  return [...found];
}

export function renderTemplate(template: string, values: TemplateValues): RenderResult {
  const missing = new Set<TemplateVariable>();
  const unknown = new Set<string>();
  const output = template.replace(VARIABLE_PATTERN, (whole, name: string) => {
    if (!KNOWN.has(name)) {
      unknown.add(name);
      return whole;
    }
    const value = values[name as TemplateVariable];
    if (value === undefined || value === null || value.trim() === "") {
      missing.add(name as TemplateVariable);
      return "";
    }
    return value;
  });
  return { output, missing: [...missing], unknown: [...unknown] };
}

/** Renders subject and body together, merging diagnostics. */
export function renderEmailTemplate(template: { subject: string; body: string }, values: TemplateValues) {
  const subject = renderTemplate(template.subject, values);
  const body = renderTemplate(template.body, values);
  return {
    subject: subject.output.replace(/\s+/g, " ").trim(),
    body: body.output,
    missing: [...new Set([...subject.missing, ...body.missing])],
    unknown: [...new Set([...subject.unknown, ...body.unknown])],
  };
}

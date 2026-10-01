import { describe, expect, it } from "vitest";
import { extractVariables, renderEmailTemplate, renderTemplate } from "@/lib/templates/render";

describe("renderTemplate", () => {
  it("replaces known variables", () => {
    const result = renderTemplate("Application for {{position}} at {{company}}", {
      position: "Associate Software Engineer",
      company: "Veyrion",
    });
    expect(result.output).toBe("Application for Associate Software Engineer at Veyrion");
    expect(result.missing).toEqual([]);
    expect(result.unknown).toEqual([]);
  });

  it("tolerates whitespace inside braces and repeated variables", () => {
    const result = renderTemplate("{{ company }} / {{company}}", { company: "Rootcode" });
    expect(result.output).toBe("Rootcode / Rootcode");
  });

  it("reports missing values and renders them as empty", () => {
    const result = renderTemplate("Hi {{name}}, call {{phone}}", { name: "Sachindu", phone: "  " });
    expect(result.output).toBe("Hi Sachindu, call ");
    expect(result.missing).toEqual(["phone"]);
  });

  it("leaves unknown variables untouched and reports them", () => {
    const result = renderTemplate("Dear {{recruiter}}", {});
    expect(result.output).toBe("Dear {{recruiter}}");
    expect(result.unknown).toEqual(["recruiter"]);
  });

  it("does not interpret values as template syntax (no double substitution)", () => {
    const result = renderTemplate("{{company}}", { company: "{{name}}", name: "x" });
    expect(result.output).toBe("{{name}}");
  });
});

describe("renderEmailTemplate", () => {
  it("renders subject and body and merges diagnostics", () => {
    const result = renderEmailTemplate(
      { subject: "Application for {{position}}\n at {{company}}", body: "Best regards,\n{{name}}\n{{email}}" },
      { position: "Intern", company: "Acme", name: "Jane" },
    );
    expect(result.subject).toBe("Application for Intern at Acme");
    expect(result.body).toBe("Best regards,\nJane\n");
    expect(result.missing).toEqual(["email"]);
  });
});

describe("extractVariables", () => {
  it("returns unique variable names", () => {
    expect(extractVariables("{{a}} {{ b }} {{a}}")).toEqual(["a", "b"]);
  });
});

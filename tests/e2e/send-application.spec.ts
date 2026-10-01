import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

/**
 * Critical workflow:
 * Create Application → Select CV → Compose Email → Preview → Confirm → Send (SES mock)
 * → Store SES Message ID → Application becomes Applied.
 */

const PASSWORD = "test-password-123"; // from .env.test
const CV_FILE = path.join(__dirname, "fixtures", "Sachindu_Kavishka_CV.pdf");

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test("redirects unauthenticated users and rejects a wrong password", async ({ page }) => {
  await page.goto("/applications");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Incorrect password" })).toBeVisible();
});

test("create application → select CV → compose → preview → confirm → send → Applied", async ({ page }) => {
  await login(page);

  // 1. Upload a CV to the document library (becomes the default CV).
  await page.goto("/documents");
  await page.getByRole("button", { name: "Upload document" }).click();
  await page.locator("#doc-file").setInputFiles(CV_FILE);
  await expect(page.locator("#doc-name")).toHaveValue("Sachindu_Kavishka_CV");
  await page.locator("#doc-name").fill("Backend Developer CV");
  await page.getByRole("dialog").getByRole("button", { name: "Upload", exact: true }).click();
  await expect(page.getByTestId("document-row")).toContainText("Backend Developer CV");
  await expect(page.getByTestId("document-row")).toContainText("Default");

  // 2. Create the application; client-side validation runs first.
  await page.goto("/applications/new");
  await page.getByRole("button", { name: "Create application" }).click();
  await expect(page.getByText("Company is required")).toBeVisible();

  await page.locator("#company").fill("Veyrion");
  await page.locator("#position").fill("Associate Software Engineer");
  await page.locator("#location").fill("Colombo");
  await page.locator("#techStack").fill("C#, .NET, React");
  await page.locator("#recipientEmail").fill("people@company.com");
  await page.locator("#emailSubject").fill("Application for Associate Software Engineer at Veyrion");
  await page.locator("#emailBody").fill("Dear Hiring Team,\n\nI am writing to apply for the Associate Software Engineer position at Veyrion.\n\nBest regards,\nSachindu");

  // 3. Select CV — the default CV is pre-selected.
  await expect(page.getByTestId("cv-select")).toContainText("Backend Developer CV");

  await page.getByRole("button", { name: "Create application" }).click();
  await expect(page).toHaveURL(/\/applications\/[a-z0-9]+$/);
  await expect(page.getByTestId("application-id")).toHaveText("APP-0001");
  await expect(page.getByTestId("current-status")).toHaveText("Draft");

  // 4. Compose.
  await page.getByRole("link", { name: "Send email" }).click();
  await expect(page.getByRole("heading", { name: "Compose application email" })).toBeVisible();
  await expect(page.locator("#to")).toHaveValue("people@company.com");
  await expect(page.locator("#subject")).toHaveValue("Application for Associate Software Engineer at Veyrion");
  await expect(page.locator("#message")).toHaveValue(/I am writing to apply/);
  await expect(page.getByRole("checkbox").first()).toBeChecked(); // CV attached

  // 5. Preview (HTML in a sandboxed iframe + plain-text alternative).
  const preview = page.frameLocator('iframe[title="Email preview"]');
  await expect(preview.locator("body")).toContainText("I am writing to apply");
  await page.getByRole("tab", { name: "Plain text" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Dear Hiring Team,");

  // 6. Confirm.
  await page.getByRole("button", { name: "Review & send" }).click();
  const confirmation = page.getByTestId("send-confirmation");
  await expect(confirmation).toContainText("Veyrion");
  await expect(confirmation).toContainText("Associate Software Engineer");
  await expect(confirmation).toContainText("people@company.com");
  await expect(confirmation).toContainText("Sachindu_Kavishka_CV.pdf");

  // 7. Send through SES (mock transport in tests).
  await page.getByTestId("confirm-send").click();

  // 8. SES Message ID stored, email Sent, application Applied.
  await expect(page).toHaveURL(/\/applications\/[a-z0-9]+$/);
  await expect(page.getByTestId("current-status")).toHaveText("Applied");
  await expect(page.getByTestId("email-status")).toHaveText("Sent");
  await expect(page.getByTestId("ses-message-id")).toHaveText(/^mock-[0-9a-f-]{36}$/);
  await expect(page.getByTestId("timeline")).toContainText("Application email sent to people@company.com");
  await expect(page.getByTestId("timeline")).toContainText("Status changed to Applied");
});

test("blocks an accidental second send to the same recipient until re-confirmed", async ({ page }) => {
  await login(page);
  await page.goto("/applications");
  await page.getByRole("link", { name: "APP-0001" }).click();
  await page.getByRole("link", { name: "Send email" }).click();
  await page.getByRole("button", { name: "Review & send" }).click();
  await page.getByTestId("confirm-send").click();
  await expect(page.getByRole("alert").filter({ hasText: "already emailed" })).toBeVisible();
  await expect(page.getByTestId("confirm-send")).toHaveText(/Send again/);
  await page.getByRole("button", { name: "Cancel" }).click();
});

test("search and status filters update the URL and the table", async ({ page }) => {
  await login(page);
  await page.goto("/applications");
  await expect(page.getByTestId("application-row")).toHaveCount(1);

  await page.getByLabel("Search applications").fill("nothing-matches-this");
  await expect(page).toHaveURL(/q=nothing-matches-this/);
  await expect(page.getByText("No matching applications")).toBeVisible();

  await page.getByRole("button", { name: "Clear" }).click();
  await page.getByTestId("status-filter").click();
  await page.getByRole("menuitemcheckbox", { name: "Applied" }).click();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/status=APPLIED/);
  await expect(page.getByTestId("application-row")).toHaveCount(1);
});

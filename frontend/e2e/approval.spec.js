import { expect, test } from "@playwright/test";

// Sandbox accounts seeded by backend/scripts/devServer.js.
const BROKER = { email: "shubham@brokery.com", password: "Broker@Shubham" };
const ADMIN = { email: "admin@brokery.com", password: "Admin@Sandbox1" };

const signIn = async (page, { email, password }) => {
	await page.goto("/login");
	await page.evaluate(() => localStorage.removeItem("brokery_token"));
	await page.goto("/login");
	await page.fill('input[name="email"]', email);
	await page.fill('input[name="password"]', password);
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL((url) => !url.pathname.startsWith("/login"));
};

test("a broker's budget change reaches the client only after an admin approves it", async ({ page }) => {
	// Broker: lands on their clients (not the admin dashboard) and proposes a new max budget.
	await signIn(page, BROKER);
	await expect(page).toHaveURL(/\/clients$/);
	await page.locator("tbody tr").first().click();

	const maxBudget = page.locator('input[name="requirements.maxBudget"]');
	await expect(maxBudget).not.toHaveValue("");
	const clientUrl = page.url();
	const original = Number(await maxBudget.inputValue());
	const proposed = String(original + 500000);

	await maxBudget.fill(proposed);
	await expect(page.getByText("Sent for approval:")).toBeVisible();
	await page.getByRole("button", { name: /save changes/i }).click();
	await expect(page.getByRole("status").filter({ hasText: "sent for approval" })).toBeVisible();
	// Not applied yet: the form shows the current value again.
	await expect(maxBudget).toHaveValue(String(original));

	// Admin: approves it from the pending queue, through the confirmation dialog.
	await signIn(page, ADMIN);
	await page.goto("/change-requests");
	const request = page.locator("li").filter({ hasText: "Max budget" }).first();
	await expect(request).toBeVisible();
	await request.getByRole("button", { name: "Approve" }).click();
	await page.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
	// The approved request leaves the pending queue (other requests may still be there).
	await expect(page.locator("li").filter({ hasText: "Max budget" })).toHaveCount(0);

	// Broker: sees the approved value, and the change in the client's history.
	await signIn(page, BROKER);
	await page.goto(clientUrl);
	await expect(page.locator('input[name="requirements.maxBudget"]')).toHaveValue(proposed);
	await expect(page.getByText(/change request for client .* approved/i).first()).toBeVisible();
});

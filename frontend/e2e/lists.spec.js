import { expect, test } from "@playwright/test";

const ADMIN = { email: "admin@brokery.com", password: "Admin@Sandbox1" };

const signIn = async (page) => {
	await page.goto("/login");
	await page.fill('input[name="email"]', ADMIN.email);
	await page.fill('input[name="password"]', ADMIN.password);
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL((url) => !url.pathname.startsWith("/login"));
};

// The sandbox seeds 15 clients, so the list (10 per page) has a second page.

test("opening a client and pressing Back returns to the same page of the list", async ({ page }) => {
	await signIn(page);
	await page.goto("/clients");
	await page.getByRole("button", { name: /next/i }).click();
	await expect(page).toHaveURL(/page=2/);
	await expect(page.getByText(/Showing 11–15 of 15/)).toBeVisible();

	await page.locator("tbody tr").first().click();
	await expect(page).toHaveURL(/\/clients\/[0-9a-f]{24}/);
	await page.goBack();

	await expect(page).toHaveURL(/page=2/);
	await expect(page.getByText(/Showing 11–15 of 15/)).toBeVisible();
});

test("a page number past the end lands on the last page instead of an empty list", async ({ page }) => {
	await signIn(page);
	await page.goto("/clients?page=9");
	await expect(page).toHaveURL(/page=2/);
	await expect(page.getByText(/Showing 11–15 of 15/)).toBeVisible();
	await expect(page.getByText("No clients found")).toBeHidden();
});

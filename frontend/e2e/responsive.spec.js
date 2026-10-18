import { expect, test } from "@playwright/test";

// Sandbox account seeded by backend/scripts/devServer.js. Admin sees every page.
const ADMIN = { email: "admin@brokery.com", password: "Admin@Sandbox1" };

const signIn = async (page) => {
	await page.goto("/login");
	await page.evaluate(() => localStorage.removeItem("brokery_token"));
	await page.goto("/login");
	await page.fill('input[name="email"]', ADMIN.email);
	await page.fill('input[name="password"]', ADMIN.password);
	await page.getByRole("button", { name: "Sign in" }).click();
	await page.waitForURL((url) => !url.pathname.startsWith("/login"));
};

const PAGES = [
	"/clients",
	"/properties",
	"/matches",
	"/change-requests",
	"/dashboard",
	"/team",
	"/ownership-claims",
	"/activity-log",
];

const VIEWPORTS = [
	{ name: "phone", width: 390, height: 844 },
	{ name: "tablet", width: 768, height: 1024 },
];

/**
 * The page itself must never scroll sideways. Wide tables and the pipeline
 * board are allowed to scroll inside their own wrapper, which is why this
 * measures the document and not the elements inside it.
 */
const horizontalOverflow = (page) =>
	page.evaluate(() => {
		const doc = document.documentElement;
		return doc.scrollWidth - doc.clientWidth;
	});

for (const viewport of VIEWPORTS) {
	test(`no sideways page scroll on a ${viewport.name}`, async ({ page }) => {
		await page.setViewportSize(viewport);
		await signIn(page);

		for (const path of PAGES) {
			await page.goto(path);
			await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
			// 1px of slack: sub-pixel layout rounding is not a broken layout.
			expect(await horizontalOverflow(page), `${path} overflows`).toBeLessThanOrEqual(1);
		}
	});
}

test("on a phone the sidebar is a drawer opened from the top bar", async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await signIn(page);
	await page.goto("/clients");

	const drawer = page.locator("#app-sidebar");
	const menu = page.getByRole("button", { name: "Open navigation menu" });

	// Closed: off-canvas, so the page gets the full width.
	await expect(menu).toBeVisible();
	await expect(drawer).not.toBeInViewport();

	await menu.click();
	await expect(drawer).toBeInViewport();
	await expect(drawer.getByRole("link", { name: "Properties" })).toBeVisible();

	// Following a link navigates and closes the drawer.
	await drawer.getByRole("link", { name: "Properties" }).click();
	await expect(page).toHaveURL(/\/properties$/);
	await expect(drawer).not.toBeInViewport();
});

test("on a desktop the sidebar stays docked beside the page", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await signIn(page);
	await page.goto("/clients");

	await expect(page.locator("#app-sidebar")).toBeInViewport();
	// No hamburger: there is nothing to open.
	await expect(page.getByRole("button", { name: "Open navigation menu" })).toBeHidden();
});

/**
 * The palette is `position: fixed`. Inside the sidebar (which is transformed to
 * slide in and out) a fixed child is positioned against the sidebar instead of
 * the screen, so it must be centred on the viewport at every size.
 */
const expectPaletteCentred = async (page, viewportWidth) => {
	const dialog = page.getByRole("dialog", { name: "Search" });
	await expect(dialog).toBeVisible();
	const box = await dialog.boundingBox();
	expect(box.width).toBeGreaterThan(Math.min(320, viewportWidth - 40));
	expect(Math.abs(box.x + box.width / 2 - viewportWidth / 2)).toBeLessThanOrEqual(8);
	await page.keyboard.press("Escape");
	await expect(dialog).toBeHidden();
};

test("Ctrl+K opens the search palette centred on a desktop", async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await signIn(page);
	await page.goto("/clients");
	// The shell is lazy-loaded: wait for it before sending the shortcut.
	await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
	await page.keyboard.press("Control+k");
	await expectPaletteCentred(page, 1440);
});

for (const viewport of VIEWPORTS) {
	test(`the top-bar search button opens the palette on a ${viewport.name}`, async ({ page }) => {
		await page.setViewportSize(viewport);
		await signIn(page);
		await page.goto("/clients");
		await page.getByRole("banner").getByRole("button", { name: "Search" }).click();
		await expectPaletteCentred(page, viewport.width);
	});
}

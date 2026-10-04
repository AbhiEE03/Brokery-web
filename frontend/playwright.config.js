import { defineConfig } from "@playwright/test";

/**
 * End-to-end tests against the real API running on a throwaway in-memory
 * MongoDB (backend `npm run dev:sandbox`), so no Docker and no real database.
 *
 * Locally:  PW_CHANNEL=msedge npx playwright test   (uses the installed Edge)
 * CI:       npx playwright install --with-deps chromium && npx playwright test
 */ 
export default defineConfig({
	testDir: "./e2e",
	timeout: 60_000,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [["github"], ["list"]] : "list",
	use: {
		baseURL: "http://localhost:5173",
		channel: process.env.PW_CHANNEL || undefined,
		trace: "retain-on-failure",
	},
	webServer: [
		{
			command: "node scripts/devServer.js",
			cwd: "../backend",
			url: "http://localhost:5000/readyz",
			timeout: 120_000,
			reuseExistingServer: !process.env.CI,
		},
		{
			command: "npx vite --port 5173 --strictPort",
			url: "http://localhost:5173",
			env: { VITE_API_URL: "http://localhost:5000/api" },
			timeout: 60_000,
			reuseExistingServer: !process.env.CI,
		},
	],
});

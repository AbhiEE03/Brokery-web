import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, test, vi } from "vitest";
import store from "../store/store";
import { setCredentials } from "../store/authSlice";
import ThemeProvider from "../theme/ThemeProvider";
import Sidebar from "../components/layout/Sidebar";

vi.mock("../hooks/queries", () => ({
	useAlerts: () => ({ data: { data: [], meta: { unreadCount: 0 } } }),
	useAlertActions: () => ({
		markRead: { mutate: vi.fn() },
		markAllRead: { mutate: vi.fn() },
	}),
}));

const renderShell = () =>
	render(
		<Provider store={store}>
			<QueryClientProvider client={new QueryClient()}>
				<ThemeProvider>
					<MemoryRouter initialEntries={["/clients"]}>
						<Sidebar />
					</MemoryRouter>
				</ThemeProvider>
			</QueryClientProvider>
		</Provider>,
	);

const drawer = () => document.getElementById("app-sidebar");
const hamburger = () =>
	screen.getByRole("button", { name: "Open navigation menu" });

describe("app shell on small screens", () => {
	beforeEach(() => {
		store.dispatch(
			setCredentials({
				user: { name: "Tiya", role: "broker" },
				token: "t",
			}),
		);
	});

	// jsdom has no viewport breakpoints, so the drawer's open/closed state is
	// what we can assert: at xl the same classes are overridden by `xl:` ones.
	test("the sidebar starts off-canvas and out of the tab order", () => {
		renderShell();
		expect(drawer()).toHaveClass("-translate-x-full", "invisible");
		expect(hamburger()).toHaveAttribute("aria-expanded", "false");
	});

	test("the menu button opens the drawer and locks the page behind it", async () => {
		renderShell();
		await userEvent.click(hamburger());

		expect(drawer()).toHaveClass("translate-x-0");
		expect(drawer()).not.toHaveClass("invisible");
		expect(hamburger()).toHaveAttribute("aria-expanded", "true");
		expect(document.body.style.overflow).toBe("hidden");
	});

	test("Escape closes the drawer and gives the page its scroll back", async () => {
		renderShell();
		await userEvent.click(hamburger());
		await userEvent.keyboard("{Escape}");

		expect(drawer()).toHaveClass("-translate-x-full", "invisible");
		expect(document.body.style.overflow).not.toBe("hidden");
	});

	test("following a nav link closes the drawer", async () => {
		renderShell();
		await userEvent.click(hamburger());
		await userEvent.click(screen.getByRole("link", { name: "Properties" }));

		expect(drawer()).toHaveClass("-translate-x-full", "invisible");
		expect(document.body.style.overflow).not.toBe("hidden");
	});

	test("the top bar carries the alerts bell, so alerts stay reachable", () => {
		renderShell();
		// One bell in the top bar (below xl) and one in the drawer (xl and up).
		expect(screen.getAllByRole("button", { name: "Notifications" })).toHaveLength(2);
	});
});

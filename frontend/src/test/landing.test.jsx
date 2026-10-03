import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, test, vi } from "vitest";
import store from "../store/store";
import { logout, setCredentials } from "../store/authSlice";
import Landing, { PORTFOLIO_URL } from "../pages/Landing";
import PublicHome from "../components/layout/PublicHome";
import Login from "../pages/Login";
import { render as prerender } from "../entry-prerender";

vi.mock("../api/authApi", () => ({ login: vi.fn() }));

afterEach(() => store.dispatch(logout()));

describe("landing page (SEO)", () => {
	test("has exactly one h1, landmark sections and real links", () => {
		render(<Landing />);
		expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
		expect(screen.getByRole("banner")).toBeInTheDocument();
		expect(screen.getByRole("main")).toBeInTheDocument();
		expect(screen.getByRole("contentinfo")).toBeInTheDocument();
		expect(screen.getAllByRole("link", { name: /demo/i })[0]).toHaveAttribute("href", "/login?demo=broker");
	});

	test("credits the author with a safe link to the portfolio", () => {
		render(<Landing />);
		const credit = screen.getByRole("link", { name: "Abhishek" });
		expect(credit).toHaveAttribute("href", PORTFOLIO_URL);
		expect(credit).toHaveAttribute("target", "_blank");
		expect(credit.getAttribute("rel")).toContain("noopener");
		expect(credit.closest("footer")).toHaveTextContent(/Built & maintained by Abhishek/);
	});

	test("every image has alt text and explicit dimensions (no layout shift)", () => {
		const { container } = render(<Landing />);
		const images = container.querySelectorAll("img");
		expect(images.length).toBeGreaterThan(0);
		images.forEach((img) => {
			expect(img.getAttribute("alt")).toBeTruthy();
			expect(img.getAttribute("width")).toBeTruthy();
			expect(img.getAttribute("height")).toBeTruthy();
		});
	});

	test("the build-time pre-render of / is the full landing page, not a loading state", () => {
		const html = prerender("/");
		expect(html).toMatch(/<h1[^>]*>The real-estate CRM that keeps every deal honest<\/h1>/);
		expect(html).toContain(PORTFOLIO_URL);
		expect(html).not.toContain("Loading…");
	});
});

describe("public home routing", () => {
	const renderAt = () =>
		render(
			<Provider store={store}>
				<MemoryRouter initialEntries={["/"]}>
					<Routes>
						<Route path="/" element={<PublicHome />} />
						<Route path="/clients" element={<p>Clients page</p>} />
						<Route path="/dashboard" element={<p>Dashboard page</p>} />
					</Routes>
				</MemoryRouter>
			</Provider>,
		);

	test("visitors see the landing page", () => {
		renderAt();
		expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/real-estate CRM/);
	});

	test("signed-in users skip it and land in the app", () => {
		store.dispatch(setCredentials({ token: "t", user: { _id: "1", name: "Tiya", role: "broker" } }));
		renderAt();
		expect(screen.getByText("Clients page")).toBeInTheDocument();
	});

	test("?demo=broker pre-fills the public demo account", () => {
		render(
			<Provider store={store}>
				<MemoryRouter initialEntries={["/login?demo=broker"]}>
					<Routes>
						<Route path="/login" element={<Login />} />
					</Routes>
				</MemoryRouter>
			</Provider>,
		);
		expect(screen.getByDisplayValue("shubham@brokery.com")).toBeInTheDocument();
		expect(screen.getByText(/Demo broker account filled in/)).toBeInTheDocument();
	});
});

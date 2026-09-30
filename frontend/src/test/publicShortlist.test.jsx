import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, test, vi } from "vitest";
import PublicShortlist from "../pages/PublicShortlist";
import { getPublicShortlist, sendShortlistFeedback } from "../api/publicApi";

vi.mock("../api/publicApi", () => ({ getPublicShortlist: vi.fn(), sendShortlistFeedback: vi.fn() }));

const SHORTLIST = {
	data: {
		buyerFirstName: "Bhaskar",
		brokerName: "Tiya",
		expiresAt: "2026-10-07T00:00:00Z",
		properties: [
			{
				_id: "p1",
				title: "3BHK Flat in Beltola",
				status: "available",
				location: { city: "Guwahati", locality: "Beltola" },
				price: 7200000,
				specs: { area: 1450, bedrooms: 3, bathrooms: 2, parking: true },
				images: [],
				feedback: null,
			},
		],
	},
};

const renderPage = () =>
	render(
		<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
			<MemoryRouter initialEntries={["/s/tok"]}>
				<Routes>
					<Route path="/s/:token" element={<PublicShortlist />} />
				</Routes>
			</MemoryRouter>
		</QueryClientProvider>,
	);

describe("buyer shortlist page", () => {
	beforeEach(() => {
		vi.mocked(getPublicShortlist).mockReset();
		vi.mocked(sendShortlistFeedback).mockReset().mockResolvedValue({ data: { changed: true } });
	});

	test("greets the buyer and sends a reaction for a property", async () => {
		vi.mocked(getPublicShortlist).mockResolvedValue(SHORTLIST);
		renderPage();

		expect(await screen.findByText("Hi Bhaskar,")).toBeInTheDocument();
		expect(screen.getByText(/Tiya picked 1 home for you/)).toBeInTheDocument();
		expect(screen.getByText("₹72 L")).toBeInTheDocument();
		expect(document.querySelector('meta[name="robots"]').content).toBe("noindex, nofollow");

		await userEvent.click(screen.getByRole("button", { name: /book a visit/i }));
		expect(sendShortlistFeedback).toHaveBeenCalledWith("tok", { propertyId: "p1", reaction: "visit", comment: undefined });
	});

	test("an expired or revoked link shows a friendly message, not an error dump", async () => {
		vi.mocked(getPublicShortlist).mockRejectedValue(Object.assign(new Error("gone"), { status: 404 }));
		renderPage();
		expect(await screen.findByText("This link isn't available")).toBeInTheDocument();
	});
});

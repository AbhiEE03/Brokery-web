import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import Recommendations from "../components/matching/Recommendations";
import { useRecommendations } from "../hooks/queries";

const mutate = vi.fn();

vi.mock("../hooks/useToast", () => ({ default: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));
vi.mock("../hooks/queries", () => ({
	useRecommendations: vi.fn(),
	useRecommendationAction: () => ({ mutate, isPending: false }),
}));

const ITEM = {
	rank: 1,
	score: 0.91,
	property: {
		_id: "p1",
		propertyCode: "00AW",
		title: "2BHK Flat in Baner",
		location: { city: "Pune", locality: "Baner" },
		pricing: { askingPrice: 9500000 },
		specs: { area: 1080, bedrooms: 2 },
		propertyType: "flat",
	},
	breakdown: [
		{ feature: "budget", value: 1, weight: 0.35, contribution: 0.35, reason: "Price ₹95 L within budget ₹85 L–₹1 Cr" },
		{ feature: "locality", value: 1, weight: 0.2, contribution: 0.2, reason: "In Baner, the locality wanted" },
		{ feature: "bedrooms", value: 1, weight: 0.15, contribution: 0.15, reason: "2 BHK as wanted" },
		{ feature: "freshness", value: 0.8, weight: 0.15, contribution: 0.12, reason: "Listed 9 days ago" },
		{ feature: "area", value: 0.5, weight: 0.15, contribution: 0.08, reason: "Client has no size preference" },
	],
};

const renderPanel = () =>
	render(
		<MemoryRouter>
			<Recommendations client={{ _id: "c1", name: "Aditya Kulkarni" }} />
		</MemoryRouter>,
	);

describe("recommendations panel", () => {
	beforeEach(() => mutate.mockReset());

	test("shows the match score, price and the top reasons; details on demand", async () => {
		vi.mocked(useRecommendations).mockReturnValue({ isPending: false, data: { data: [ITEM], meta: { candidates: 4 } } });
		renderPanel();

		expect(screen.getByText("91% match")).toBeInTheDocument();
		expect(screen.getByText("₹95 L")).toBeInTheDocument();
		expect(screen.getByText("In Baner, the locality wanted")).toBeInTheDocument();
		expect(screen.queryByText("Client has no size preference")).not.toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: /score breakdown/i }));
		expect(screen.getByText("Client has no size preference")).toBeInTheDocument();
	});

	test("create match sends the property and its rank", async () => {
		vi.mocked(useRecommendations).mockReturnValue({ isPending: false, data: { data: [ITEM], meta: {} } });
		renderPanel();
		await userEvent.click(screen.getByRole("button", { name: /create match/i }));
		expect(mutate).toHaveBeenCalledWith({ propertyId: "p1", action: "link", rank: 1 }, expect.any(Object));
	});

	test("explains an empty list instead of showing nothing", () => {
		vi.mocked(useRecommendations).mockReturnValue({
			isPending: false,
			data: { data: [], meta: { hint: "Add a city to this client's requirements to get recommendations." } },
		});
		renderPanel();
		expect(screen.getByText(/add a city/i)).toBeInTheDocument();
	});
});

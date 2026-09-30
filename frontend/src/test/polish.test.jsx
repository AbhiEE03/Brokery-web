import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, test, vi } from "vitest";
import store from "../store/store";
import { logout, setCredentials } from "../store/authSlice";
import PipelineBoard from "../components/clients/PipelineBoard";
import CommandPalette from "../components/layout/CommandPalette";
import AsyncCombobox from "../components/ui/AsyncCombobox";
import api from "../api/axiosInstance";

vi.mock("../api/axiosInstance", () => ({ default: { get: vi.fn() } }));

const withProviders = (ui, path = "/") =>
	render(
		<Provider store={store}>
			<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
				<MemoryRouter initialEntries={[path]}>
					<Routes>
						<Route path="/" element={ui} />
						<Route path="/clients/:id" element={<p>Client detail page</p>} />
					</Routes>
				</MemoryRouter>
			</QueryClientProvider>
		</Provider>,
	);

afterEach(() => store.dispatch(logout()));

describe("pipeline board", () => {
	const clients = [
		{ _id: "c1", name: "Rahul Sinha", clientCode: "CL-000026", pipelineStage: "site_visit", requirements: { city: "Patna", minBudget: 7500000, maxBudget: 9000000 } },
		{ _id: "c2", name: "Priya Kumari", clientCode: "CL-000027", pipelineStage: "contacted", requirements: {} },
	];

	test("groups clients by stage with counts and moves a client from the keyboard menu", async () => {
		const onMove = vi.fn();
		withProviders(<PipelineBoard clients={clients} pendingByClient={new Map([["c2", "site_visit"]])} isAdmin={false} onMove={onMove} busyId={null} />);

		const siteVisit = screen.getByRole("region", { name: "Site visit column" });
		expect(within(siteVisit).getByText("Rahul Sinha")).toBeInTheDocument();
		expect(within(siteVisit).getByText("₹75 L–₹90 L")).toBeInTheDocument();
		expect(screen.getByText(/Awaiting approval → Site visit/)).toBeInTheDocument();

		await userEvent.selectOptions(screen.getByLabelText("Move Rahul Sinha to stage"), "negotiation");
		expect(onMove).toHaveBeenCalledWith(clients[0], "negotiation");
	});
});

describe("command palette", () => {
	test("finds a client by name and opens it with Enter", async () => {
		store.dispatch(setCredentials({ token: "t", user: { _id: "u", name: "Admin", role: "admin" } }));
		vi.mocked(api.get).mockImplementation(async (url) =>
			url === "/clients" ?
				{ data: { data: [{ _id: "c9", name: "Ananya Rao", clientCode: "CL-000033", pipelineStage: "negotiation", requirements: { city: "Bengaluru" } }] } }
			:	{ data: { data: [] } },
		);
		withProviders(<CommandPalette open onClose={() => {}} />);

		expect(screen.getByRole("option", { name: /Ownership claims/ })).toBeInTheDocument(); // admin-only page listed
		await userEvent.type(screen.getByRole("combobox", { name: "Search" }), "anan");
		expect(await screen.findByText("Ananya Rao")).toBeInTheDocument();
		expect(screen.getByText(/CL-000033 · Negotiation · Bengaluru/)).toBeInTheDocument();

		await userEvent.keyboard("{Enter}");
		expect(await screen.findByText("Client detail page")).toBeInTheDocument();
	});

	test("brokers don't see admin-only pages", () => {
		store.dispatch(setCredentials({ token: "t", user: { _id: "u", name: "Tiya", role: "broker" } }));
		withProviders(<CommandPalette open onClose={() => {}} />);
		expect(screen.queryByRole("option", { name: /Ownership claims/ })).not.toBeInTheDocument();
		expect(screen.getByRole("option", { name: /Clients · pipeline board/ })).toBeInTheDocument();
	});
});

describe("async combobox", () => {
	test("searches as you type and picks a result", async () => {
		const search = vi.fn(async (text) =>
			text.includes("bel") ? [{ value: "p1", label: "3BHK Flat in Beltola (00AT)", hint: "₹72 L · Beltola" }] : [],
		);
		const onChange = vi.fn();
		withProviders(<AsyncCombobox label="Property" queryKey="t" search={search} value={null} onChange={onChange} />);

		await userEvent.type(screen.getByRole("combobox", { name: "Property" }), "bel");
		await userEvent.click(await screen.findByText("3BHK Flat in Beltola (00AT)"));
		expect(onChange).toHaveBeenCalledWith({ value: "p1", label: "3BHK Flat in Beltola (00AT)", hint: "₹72 L · Beltola" });
	});
});

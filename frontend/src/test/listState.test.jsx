import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, test, vi } from "vitest";
import store from "../store/store";
import { setCredentials } from "../store/authSlice";
import api from "../api/axiosInstance";
import Clients from "../pages/Clients";
import ChangeRequests from "../pages/ChangeRequests";
import OwnershipClaims from "../pages/OwnershipClaims";
import Properties from "../pages/Properties";
import Matches from "../pages/Matches";
import ActivityLog from "../pages/ActivityLog";
import Pagination from "../components/ui/Pagination";

vi.mock("../api/axiosInstance", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock("../hooks/useToast", () => ({ default: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));

const Where = () => <p data-testid="where">{useLocation().pathname + useLocation().search}</p>;

const renderAt = (ui, path) =>
	render(
		<Provider store={store}>
			<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
				<MemoryRouter initialEntries={[path]}>
					{ui}
					<Where />
				</MemoryRouter>
			</QueryClientProvider>
		</Provider>,
	);

const listOf = (rows, pagination) => ({ data: { success: true, data: rows, pagination } });
const callsTo = (url) => vi.mocked(api.get).mock.calls.filter(([u]) => u === url).map(([, config]) => config.params);

beforeEach(() => {
	vi.mocked(api.get).mockReset();
	store.dispatch(setCredentials({ user: { name: "Admin", role: "admin" }, token: "t" }));
});

describe("pagination bar", () => {
	test("says which rows are on screen and how many exist", () => {
		render(<Pagination page={2} pages={18} total={175} limit={10} onPageChange={() => {}} />);
		expect(screen.getByText(/Showing 11–20 of 175/)).toBeInTheDocument();
	});

	test("still shows the total when everything fits on one page", () => {
		render(<Pagination page={1} pages={1} total={3} limit={10} onPageChange={() => {}} />);
		expect(screen.getByText(/Showing 1–3 of 3/)).toBeInTheDocument();
	});
});

describe("clients list keeps its place in the URL", () => {
	test("page, search and stage come from the address, so Back and refresh restore them", async () => {
		vi.mocked(api.get).mockResolvedValue(listOf([], { page: 3, pages: 3, total: 25 }));
		renderAt(<Clients />, "/clients?page=3&q=sinha&stage=lead");
		await waitFor(() => expect(callsTo("/clients").length).toBeGreaterThan(0));
		expect(callsTo("/clients")[0]).toMatchObject({ page: 3, search: "sinha", stage: "lead", limit: 10 });
		expect(screen.getByLabelText("Search clients")).toHaveValue("sinha");
	});

	test("going to the next page writes it to the address", async () => {
		vi.mocked(api.get).mockImplementation(async (url, { params }) =>
			url === "/clients" ?
				listOf([{ _id: "c1", name: "Rahul", clientCode: "CL-1", phone: "9000000000", pipelineStage: "lead", requirements: {} }], { page: params.page ?? 1, pages: 4, total: 31 })
			:	listOf([], { page: 1, pages: 1, total: 0 }),
		);
		renderAt(<Clients />, "/clients");
		await userEvent.click(await screen.findByRole("button", { name: /next/i }));
		await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("page=2"));
	});
});

describe("a page past the end is clamped, never an empty trap", () => {
	test("approvals: after the last item on the last page is handled, you land on the new last page", async () => {
		vi.mocked(api.get).mockImplementation(async (url, { params }) => {
			if (params.page > 2) return listOf([], { page: params.page, pages: 2, total: 12 });
			return listOf([{ _id: "r1", entityType: "client", status: "pending", entityId: { _id: "c1", name: "Rahul Sinha", clientCode: "CL-1" }, requestedBy: { name: "U" }, changes: [{ field: "notes", oldValue: "a", newValue: "b" }], createdAt: "2026-09-29T10:00:00Z" }], { page: params.page, pages: 2, total: 12 });
		});
		renderAt(<ChangeRequests />, "/change-requests?page=5");
		await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("page=2"));
		expect(await screen.findByText(/Rahul Sinha/)).toBeInTheDocument();
		expect(screen.queryByText(/Nothing waiting for review/)).toBeNull();
	});

	test("clients: a stale page number falls back to the last real page", async () => {
		vi.mocked(api.get).mockImplementation(async (url, { params }) =>
			url === "/clients" ?
				listOf(params.page > 2 ? [] : [{ _id: "c1", name: "Rahul", clientCode: "CL-1", phone: "9000000000", pipelineStage: "lead", requirements: {} }], { page: params.page, pages: 2, total: 15 })
			:	listOf([], { page: 1, pages: 1, total: 0 }),
		);
		renderAt(<Clients />, "/clients?page=9");
		await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("page=2"));
		expect(await screen.findByText("Rahul")).toBeInTheDocument();
	});

	test("ownership claims: a stale page falls back instead of saying there are no claims", async () => {
		vi.mocked(api.get).mockImplementation(async (url, { params }) =>
			listOf(params.page > 1 ? [] : [{ _id: "o1", status: "open", phoneKey: "+919000000000", existingClient: { name: "Aditya", clientCode: "CL-1" }, existingBroker: { name: "A" }, claimant: { name: "B" }, submitted: { name: "Adi" }, evidence: {}, createdAt: "2026-09-29T10:00:00Z" }], { page: params.page, pages: 1, total: 1 }),
		);
		renderAt(<OwnershipClaims />, "/ownership-claims?page=4");
		await waitFor(() => expect(screen.getByTestId("where")).not.toHaveTextContent("page="));
		expect(await screen.findByText(/Aditya/)).toBeInTheDocument();
	});

	test("properties: filters and page come from the address", async () => {
		vi.mocked(api.get).mockResolvedValue(listOf([], { page: 2, pages: 2, total: 14 }));
		renderAt(<Properties />, "/properties?page=2&q=villa&type=flat");
		await waitFor(() => expect(callsTo("/properties").length).toBeGreaterThan(0));
		expect(callsTo("/properties")[0]).toMatchObject({ page: 2, search: "villa", type: "flat", limit: 12 });
	});
});

describe("approving a change refreshes the lists it changed", () => {
	test("clients and properties are re-fetched, not served stale from cache", async () => {
		const invalidate = vi.spyOn(QueryClient.prototype, "invalidateQueries");
		vi.mocked(api.get).mockResolvedValue(
			listOf([{ _id: "r1", entityType: "client", status: "pending", entityId: { _id: "c1", name: "Rahul Sinha", clientCode: "CL-1" }, requestedBy: { name: "U" }, changes: [{ field: "pipelineStage", oldValue: "lead", newValue: "closed" }], createdAt: "2026-09-29T10:00:00Z" }], { page: 1, pages: 1, total: 1 }),
		);
		vi.mocked(api.post).mockResolvedValue({ data: { success: true } });
		renderAt(<ChangeRequests />, "/change-requests");
		await userEvent.click(await screen.findByRole("button", { name: /^approve$/i }));
		await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /^approve$/i }));
		await waitFor(() => expect(api.post).toHaveBeenCalled());
		const keys = invalidate.mock.calls.map(([arg]) => arg.queryKey[0]);
		expect(keys).toEqual(expect.arrayContaining(["changeRequests", "clients", "properties"]));
		invalidate.mockRestore();
	});
});

describe("matches and activity log follow the same contract", () => {
	test("matches: page from the address, stale page clamped, total shown", async () => {
		const row = { _id: "m1", interestLevel: "high", createdAt: "2026-09-29T10:00:00Z", client: { name: "Rahul Sinha", clientCode: "CL-1" }, property: { title: "Baner 2BHK", propertyCode: "00AA" }, createdBy: { name: "Tiya" } };
		vi.mocked(api.get).mockImplementation(async (url, { params }) =>
			listOf(params.page > 2 ? [] : [row], { page: params.page, pages: 2, total: 14 }),
		);
		renderAt(<Matches />, "/matches?page=7");
		await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("page=2"));
		expect(await screen.findByText("Rahul Sinha")).toBeInTheDocument();
		expect(screen.getByText(/of 14/)).toBeInTheDocument();
	});

	test("activity log: filters and page come from the address", async () => {
		vi.mocked(api.get).mockImplementation(async (url) =>
			url === "/auth/brokers" ? { data: { data: [] } } : listOf([], { page: 3, pages: 3, total: 25 }),
		);
		renderAt(<ActivityLog />, "/activity-log?page=3&entity=client");
		await waitFor(() => expect(callsTo("/activity").length).toBeGreaterThan(0));
		expect(callsTo("/activity")[0]).toMatchObject({ page: 3, entityType: "client", limit: 10 });
		expect(callsTo("/activity")).toHaveLength(1);
	});
});

import { render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, test, vi } from "vitest";
import store from "../store/store";
import { setCredentials } from "../store/authSlice";
import api from "../api/axiosInstance";
import Clients from "../pages/Clients";
import Dashboard from "../pages/Dashboard";
import { usePendingStageChanges } from "../hooks/queries";

vi.mock("../api/axiosInstance", () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
vi.mock("../hooks/useToast", () => ({ default: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));
// Recharts needs real layout; the numbers are what these tests are about.
vi.mock("recharts", () => {
	const Box = ({ children }) => <div>{children}</div>;
	return { Bar: Box, BarChart: Box, CartesianGrid: Box, Cell: Box, Pie: Box, PieChart: Box, ResponsiveContainer: Box, Tooltip: Box, XAxis: Box, YAxis: Box };
});

const wrapper = ({ children }) => (
	<Provider store={store}>
		<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
			<MemoryRouter initialEntries={["/clients?view=board"]}>{children}</MemoryRouter>
		</QueryClientProvider>
	</Provider>
);

const clientRows = (from, count) =>
	Array.from({ length: count }, (_, i) => ({
		_id: `c${from + i}`,
		name: `Client ${from + i}`,
		clientCode: `CL-${from + i}`,
		phone: "9000000000",
		pipelineStage: "lead",
		requirements: { maxBudget: 1000000 },
	}));

beforeEach(() => {
	vi.mocked(api.get).mockReset();
	store.dispatch(setCredentials({ user: { name: "Admin", role: "admin" }, token: "t" }));
});

describe("pipeline board with more clients than one fetch holds", () => {
	const serve = () =>
		vi.mocked(api.get).mockImplementation(async (url, { params }) => {
			if (url === "/clients") {
				const page = params.page ?? 1;
				return { data: { success: true, data: page === 1 ? clientRows(1, 100) : clientRows(101, 75), pagination: { page, limit: 100, pages: 2, total: 175 } } };
			}
			return { data: { success: true, data: [], pagination: { page: 1, pages: 1, total: 0 } } };
		});

	test("says how many are loaded out of how many exist, and loads the rest on request", async () => {
		serve();
		render(<Clients />, { wrapper });
		expect(await screen.findByText(/Showing 100 of 175 clients/)).toBeInTheDocument();
		expect(screen.getByText(/counts and totals below cover only these/i)).toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: /load 75 more/i }));
		await waitFor(() => expect(screen.queryByText(/Showing 100 of 175/)).toBeNull());
		expect(screen.getAllByRole("article")).toHaveLength(175);
		expect(screen.queryByRole("button", { name: /load .* more/i })).toBeNull();
	});

	test("every column header shows the server's total for its stage, not the cards that happen to be loaded", async () => {
		vi.mocked(api.get).mockImplementation(async (url, { params }) => {
			if (url === "/analytics/pipeline-distribution")
				return { data: { success: true, data: [{ _id: "lead", count: 162 }, { _id: "contacted", count: 2 }, { _id: "closed", count: 6 }, { _id: "lost", count: 5 }] } };
			if (url === "/clients") {
				const page = params.page ?? 1;
				// 100 newest are all leads: the older, further-along clients are cut off.
				return { data: { success: true, data: page === 1 ? clientRows(1, 100) : [...clientRows(101, 62), ...[["contacted", 2], ["closed", 6], ["lost", 5]].flatMap(([stage, n], k) => clientRows(900 + k * 10, n).map((c) => ({ ...c, pipelineStage: stage })))], pagination: { page, limit: 100, pages: 2, total: 175 } } };
			}
			return { data: { success: true, data: [], pagination: { page: 1, pages: 1, total: 0 } } };
		});
		render(<Clients />, { wrapper });
		await screen.findByText(/Showing 100 of 175/);

		const column = (name) => screen.getByRole("region", { name: `${name} column` });
		await waitFor(() => expect(within(column("Contacted")).getByText("2")).toBeInTheDocument());
		expect(within(column("Contacted")).getByText("showing 0")).toBeInTheDocument();
		expect(within(column("Closed")).getByText("6")).toBeInTheDocument();
		expect(within(column("Lead")).getByText("162")).toBeInTheDocument();
		expect(within(column("Lead")).getByText("showing 100")).toBeInTheDocument();
		// Stages with no clients at all still read 0, with nothing to load.
		expect(within(column("Negotiation")).getByText("0")).toBeInTheDocument();
		expect(within(column("Negotiation")).queryByText(/showing/)).toBeNull();
		// A partial column doesn't pretend to know its rupee total.
		const header = (name) => column(name).querySelector("header");
		expect(header("Lead")).not.toHaveTextContent("₹");
		// Nothing loaded yet is not described as "drop a client here".
		expect(within(column("Contacted")).queryByText("Drop a client here")).toBeNull();
		expect(within(column("Negotiation")).getByText("Drop a client here")).toBeInTheDocument();

		// Once everything is loaded the hints go away and the rupee total returns.
		await userEvent.click(screen.getByRole("button", { name: /load 75 more/i }));
		await waitFor(() => expect(screen.queryByText(/showing 100/)).toBeNull());
		expect(within(column("Contacted")).queryByText(/showing/)).toBeNull();
		expect(header("Lead")).toHaveTextContent(/₹.*(Cr|L)/);
	});

	describe("when the per-stage totals can't be fetched", () => {
		const forbidden = Object.assign(new Error("Forbidden"), { response: { status: 403, data: { message: "Forbidden" } } });
		const offline = new Error("Network Error");
		let distribution;

		const serve = () =>
			vi.mocked(api.get).mockImplementation(async (url, { params }) => {
				if (url === "/analytics/pipeline-distribution") return distribution();
				if (url === "/clients") {
					const page = params.page ?? 1;
					return { data: { success: true, data: page === 1 ? clientRows(1, 100) : clientRows(101, 75), pagination: { page, limit: 100, pages: 2, total: 175 } } };
				}
				return { data: { success: true, data: [], pagination: { page: 1, pages: 1, total: 0 } } };
			});
		const column = (name) => screen.getByRole("region", { name: `${name} column` });
		const header = (name) => column(name).querySelector("header");
		const OTHERS = ["Contacted", "Site visit", "Negotiation", "Closed", "Lost"];

		test.each([
			["a 403", forbidden],
			["a network error", offline],
		])("%s: the headers show a dash and a retry, never a believable 0", async (_, failure) => {
			distribution = () => {
				throw failure;
			};
			serve();
			render(<Clients />, { wrapper });
			await screen.findByText(/Showing 100 of 175/);
			const alert = await screen.findByRole("alert");
			expect(within(alert).getByRole("button", { name: /retry/i })).toBeInTheDocument();
			for (const name of OTHERS) {
				expect(header(name)).toHaveTextContent("—");
				expect(header(name)).not.toHaveTextContent(/0/);
				expect(within(column(name)).queryByText("Drop a client here")).toBeNull();
			}
			// Lead can't be trusted either: 100 loaded is not its total.
			expect(header("Lead")).toHaveTextContent("—");
			expect(header("Lead")).toHaveTextContent("showing 100");
		});

		test("Retry fetches the totals again and the headers recover", async () => {
			let calls = 0;
			distribution = () => {
				calls += 1;
				if (calls === 1) throw offline;
				return { data: { success: true, data: [{ _id: "lead", count: 162 }, { _id: "contacted", count: 2 }, { _id: "closed", count: 6 }, { _id: "lost", count: 5 }] } };
			};
			serve();
			render(<Clients />, { wrapper });
			await userEvent.click(await within(await screen.findByRole("alert")).findByRole("button", { name: /retry/i }));
			await waitFor(() => expect(header("Contacted")).toHaveTextContent("2"));
			expect(header("Lead")).toHaveTextContent("162");
			expect(header("Negotiation")).toHaveTextContent("0");
			expect(screen.queryByRole("alert")).toBeNull();
			expect(calls).toBe(2);
		});

		test("with every client loaded, the loaded counts are exact and no error is needed", async () => {
			distribution = () => {
				throw forbidden;
			};
			vi.mocked(api.get).mockImplementation(async (url) =>
				url === "/analytics/pipeline-distribution" ? distribution() : { data: { success: true, data: url === "/clients" ? clientRows(1, 3) : [], pagination: { page: 1, limit: 100, pages: 1, total: url === "/clients" ? 3 : 0 } } },
			);
			render(<Clients />, { wrapper });
			await screen.findAllByRole("article");
			expect(header("Lead")).toHaveTextContent("3");
			expect(header("Closed")).toHaveTextContent("0");
			expect(screen.queryByRole("alert")).toBeNull();
		});
	});

	test("stays quiet when everything fits", async () => {
		vi.mocked(api.get).mockImplementation(async (url) => ({
			data: { success: true, data: url === "/clients" ? clientRows(1, 3) : [], pagination: { page: 1, limit: 100, pages: 1, total: url === "/clients" ? 3 : 0 } },
		}));
		render(<Clients />, { wrapper });
		expect(await screen.findAllByRole("article")).toHaveLength(3);
		expect(screen.queryByText(/Showing .* of/)).toBeNull();
	});
});

describe("awaiting-approval badges past the first 100 pending requests", () => {
	test("reads every page of pending changes, not just the first", async () => {
		const request = (n) => ({ entityId: { _id: `c${n}` }, changes: [{ field: "pipelineStage", newValue: "closed" }] });
		vi.mocked(api.get).mockImplementation(async (url, { params }) => ({
			data: { data: params.page === 2 ? [request(101)] : Array.from({ length: 100 }, (_, i) => request(i + 1)), pagination: { page: params.page ?? 1, pages: 2, total: 101 } },
		}));
		const { result } = renderHook(() => usePendingStageChanges(), { wrapper });
		await waitFor(() => expect(result.current.data).toBeInstanceOf(Map));
		expect(result.current.data.size).toBe(101);
		expect(result.current.data.get("c101")).toBe("closed");
	});
});

describe("dashboard when something fails to load", () => {
	const answer = (failing) =>
		vi.mocked(api.get).mockImplementation(async (url) => {
			if (url.endsWith(failing)) throw Object.assign(new Error("boom"), { response: { status: 500, data: { message: "Internal Server Error" } } });
			const payloads = {
				"/analytics/summary": { totalClients: 175, totalProperties: 70, closedDeals: 9, pendingApprovals: 41, activeListings: 60, activeBrokers: 3 },
			};
			return { data: { success: true, data: payloads[url] ?? [] } };
		});

	test("a failing summary shows a dash and a retry, never a believable zero", async () => {
		answer("/analytics/summary");
		render(<Dashboard />, { wrapper });
		expect(await screen.findByRole("button", { name: /try again/i })).toBeInTheDocument();
		expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
		expect(screen.queryByText("0")).toBeNull();
	});

	test("a failing funnel doesn't blank the numbers that did load", async () => {
		answer("/analytics/funnel");
		render(<Dashboard />, { wrapper });
		expect(await screen.findByText("175")).toBeInTheDocument();
		expect(screen.getByText("41")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
	});
});

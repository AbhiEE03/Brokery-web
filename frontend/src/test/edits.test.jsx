import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, test, vi } from "vitest";
import store from "../store/store";
import ClientDetail from "../pages/ClientDetail";
import ChangeRequests from "../pages/ChangeRequests";
import { buildPatch, changedPaths } from "../utils/diff";
import { formatINR } from "../utils/format";
import { getClientById, updateClient } from "../api/clientApi";

const mutate = vi.fn();

vi.mock("../api/clientApi", () => ({
	getClientById: vi.fn(),
	updateClient: vi.fn(),
	uploadClientDocument: vi.fn(),
}));

vi.mock("../hooks/queries", () => ({
	useEditPolicies: () => ({
		data: {
			appliesDirectly: false,
			client: { direct: ["phone", "notes", "email"], approval: ["pipelineStage", "requirements.maxBudget"] },
		},
	}),
	useRecordHistory: () => ({ isPending: false, isError: false, data: { data: [] } }),
	useChangeRequests: () => ({
		isPending: false,
		isError: false,
		data: {
			data: [
				{
					_id: "cr1",
					entityType: "client",
					status: "pending",
					entityId: { _id: "c1", name: "Rahul Sinha", clientCode: "CL-000026" },
					requestedBy: { name: "Uttkarsh" },
					changes: [{ field: "requirements.maxBudget", oldValue: 9000000, newValue: 9500000 }],
					createdAt: "2026-09-29T10:00:00Z",
				},
			],
			pagination: { page: 1, pages: 1, total: 1 },
		},
	}),
	useChangeRequestDecision: () => ({ mutate, isPending: false }),
}));

const CLIENT = {
	_id: "c1",
	name: "Rahul Sinha",
	clientCode: "CL-000026",
	phone: "9000000125",
	email: "rahul@example.com",
	notes: "",
	pipelineStage: "site_visit",
	requirements: { city: "Patna", locality: "Boring Road", minBudget: 7500000, maxBudget: 9000000, bedrooms: 3 },
	documents: [],
};

const renderWithProviders = (ui, path = "/") => {
	const queryClient = new QueryClient();
	return render(
		<Provider store={store}>
			<QueryClientProvider client={queryClient}>
				<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
			</QueryClientProvider>
		</Provider>,
	);
};

describe("diff helpers", () => {
	test("only changed fields end up in the patch, numbers as numbers", () => {
		const before = { phone: "9000000125", notes: "", requirements: { city: "Patna", maxBudget: 9000000 } };
		const after = { phone: "9000000125", notes: "call after 6", requirements: { city: "Patna", maxBudget: "9500000" } };
		const paths = changedPaths(before, after);
		expect(paths).toEqual(["notes", "requirements.maxBudget"]);
		expect(buildPatch(paths, after, new Set(["requirements.maxBudget"]))).toEqual({
			notes: "call after 6",
			requirements: { maxBudget: 9500000 },
		});
	});

	test("prices read the way brokers say them", () => {
		expect(formatINR(9500000)).toBe("₹95 L");
		expect(formatINR(14500000)).toBe("₹1.45 Cr");
		expect(formatINR(75000)).toBe("₹75,000");
	});
});

describe("client edit form", () => {
	beforeEach(() => {
		vi.mocked(getClientById).mockResolvedValue({ data: CLIENT });
		vi.mocked(updateClient).mockReset().mockResolvedValue({ message: "Changes saved", data: { updated: CLIENT, pending: null } });
	});

	const renderDetail = () =>
		renderWithProviders(
			<Routes>
				<Route path="/clients/:id" element={<ClientDetail />} />
			</Routes>,
			"/clients/c1",
		);

	test("sends only the field the broker changed", async () => {
		renderDetail();
		const phone = await screen.findByDisplayValue("9000000125");
		await userEvent.clear(phone);
		await userEvent.type(phone, "9000000999");
		await userEvent.click(screen.getByRole("button", { name: /save changes/i }));

		expect(updateClient).toHaveBeenCalledWith("c1", { phone: "9000000999" });
	});

	test("shows which changes need approval before saving", async () => {
		renderDetail();
		const maxBudget = await screen.findByDisplayValue("9000000");
		await userEvent.clear(maxBudget);
		await userEvent.type(maxBudget, "9500000");
		expect(screen.getByText(/sent for approval:/i).parentElement).toHaveTextContent("Max budget");
	});

	test("saving without changes sends nothing", async () => {
		renderDetail();
		await screen.findByDisplayValue("9000000125");
		await userEvent.click(screen.getByRole("button", { name: /save changes/i }));
		expect(updateClient).not.toHaveBeenCalled();
		expect(screen.getByText(/nothing to save/i)).toBeInTheDocument();
	});
});

describe("approving a change request", () => {
	beforeEach(() => {
		mutate.mockReset();
		store.dispatch({ type: "auth/setCredentials", payload: { token: "t", user: { _id: "a", name: "Admin", role: "admin" } } });
	});

	test("approve asks for confirmation in a dialog, then sends the decision with the note", async () => {
		renderWithProviders(<ChangeRequests />);
		expect(screen.getByText("₹90 L")).toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: "Approve" }));
		const dialog = screen.getByRole("dialog");
		await userEvent.type(within(dialog).getByRole("textbox"), "Budget confirmed on call");
		await userEvent.click(within(dialog).getByRole("button", { name: "Approve" }));

		expect(mutate).toHaveBeenCalledWith(
			{ id: "cr1", action: "approve", note: "Budget confirmed on call" },
			expect.any(Object),
		);
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	test("cancelling the dialog sends nothing", async () => {
		renderWithProviders(<ChangeRequests />);
		await userEvent.click(screen.getByRole("button", { name: "Reject" }));
		await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel" }));
		expect(mutate).not.toHaveBeenCalled();
	});
});

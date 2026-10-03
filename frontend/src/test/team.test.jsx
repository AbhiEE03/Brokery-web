import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import store from "../store/store";
import { setCredentials } from "../store/authSlice";
import Team from "../pages/Team";

const create = vi.fn();
const setStatus = vi.fn();
const resetPassword = vi.fn();
const reassignClients = vi.fn();

vi.mock("../hooks/useToast", () => ({ default: () => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }) }));
vi.mock("../hooks/queries", () => ({
	useTeam: () => ({
		isPending: false,
		data: [
			{ _id: "b1", name: "Tiya", email: "tiya@brokery.com", isActive: true, clientCount: 4, openClientCount: 3, createdAt: "2026-09-29" },
			{ _id: "b2", name: "Abhiraj", email: "abhiraj@brokery.com", isActive: true, clientCount: 0, openClientCount: 0, createdAt: "2026-09-29" },
			{ _id: "b3", name: "Uttkarsh", email: "uttkarsh@brokery.com", isActive: true, clientCount: 4, openClientCount: 4, createdAt: "2026-09-29" },
		],
	}),
	useTeamMutations: () => ({
		create: { mutate: create, isPending: false },
		setStatus: { mutate: setStatus, isPending: false },
		resetPassword: { mutate: resetPassword, isPending: false },
		reassignClients: { mutate: reassignClients, isPending: false },
	}),
}));

const renderTeam = () =>
	render(
		<Provider store={store}>
			<MemoryRouter>
				<Team />
			</MemoryRouter>
		</Provider>,
	);
const row = (name) => screen.getByText(name).closest("tr");

describe("team page", () => {
	beforeEach(() => {
		[create, setStatus, resetPassword, reassignClients].forEach((fn) => fn.mockReset());
		store.dispatch(setCredentials({ token: "t", user: { _id: "admin", name: "Admin", role: "admin" } }));
	});

	test("adding a broker without a password shows the generated one once", async () => {
		create.mockImplementation((payload, { onSuccess }) =>
			onSuccess({ data: { user: { name: "Pushpendu", email: "p@brokery.com", role: "broker" }, generatedPassword: "Xy7#kq9Lm2@wPz4r" } }),
		);
		renderTeam();
		await userEvent.click(screen.getByRole("button", { name: /add broker/i }));
		await userEvent.type(screen.getByLabelText("Name"), "Pushpendu");
		await userEvent.type(screen.getByLabelText("Email"), "p@brokery.com");
		await userEvent.click(screen.getByRole("button", { name: "Add" }));

		expect(create.mock.calls[0][0]).toEqual({ name: "Pushpendu", email: "p@brokery.com", password: undefined, role: "broker" });
		expect(screen.getByText("Xy7#kq9Lm2@wPz4r")).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));
		expect(screen.queryByText("Xy7#kq9Lm2@wPz4r")).not.toBeInTheDocument();
	});

	test("deactivating a broker with clients offboards them: move clients first, then deactivate", async () => {
		reassignClients.mockImplementation((vars, { onSuccess }) => onSuccess({ message: "Moved 4 clients to Uttkarsh" }));
		renderTeam();
		await userEvent.click(within(row("Tiya")).getByRole("button", { name: /deactivate/i }));

		const dialog = screen.getByRole("dialog");
		expect(within(dialog).getByText(/still has 4 clients/)).toBeInTheDocument();
		await userEvent.selectOptions(within(dialog).getByLabelText("New broker"), "b3");
		await userEvent.click(within(dialog).getByRole("button", { name: /move clients & deactivate/i }));

		expect(reassignClients.mock.calls[0][0]).toEqual({ id: "b1", toBrokerId: "b3" });
		expect(setStatus.mock.calls[0][0]).toEqual({ id: "b1", isActive: false });
	});

	test("a broker without clients is deactivated after a confirmation", async () => {
		renderTeam();
		await userEvent.click(within(row("Abhiraj")).getByRole("button", { name: /deactivate/i }));
		await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Deactivate" }));
		expect(setStatus.mock.calls[0][0]).toEqual({ id: "b2", isActive: false });
		expect(reassignClients).not.toHaveBeenCalled();
	});

	test("resetting a password confirms first, then shows the new temporary password", async () => {
		resetPassword.mockImplementation((id, { onSuccess }) => onSuccess({ data: { temporaryPassword: "Temp#Pass2Word9x" } }));
		renderTeam();
		await userEvent.click(within(row("Tiya")).getByRole("button", { name: /reset password/i }));
		await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Reset password" }));
		expect(resetPassword.mock.calls[0][0]).toBe("b1");
		expect(screen.getByText("Temp#Pass2Word9x")).toBeInTheDocument();
	});
});

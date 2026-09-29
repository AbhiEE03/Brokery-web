import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { configureStore } from "@reduxjs/toolkit";
import { beforeEach, describe, expect, test, vi } from "vitest";
import authReducer from "../store/authSlice";
import Login from "./Login";
import { login } from "../api/authApi";

vi.mock("../api/authApi", () => ({ login: vi.fn() }));

const renderLogin = () => {
	const store = configureStore({ reducer: { auth: authReducer } });
	render(
		<Provider store={store}>
			<MemoryRouter initialEntries={["/login"]}>
				<Routes>
					<Route path="/login" element={<Login />} />
					<Route path="/dashboard" element={<p>Dashboard page</p>} />
					<Route path="/clients" element={<p>Clients page</p>} />
				</Routes>
			</MemoryRouter>
		</Provider>,
	);
	return store;
};

describe("Login", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.mocked(login).mockReset();
	});

	test("stores credentials and navigates after a successful login", async () => {
		vi.mocked(login).mockResolvedValue({
			token: "t0ken",
			user: { _id: "1", name: "Admin", role: "admin" },
		});
		const store = renderLogin();

		await userEvent.type(screen.getByPlaceholderText("admin@brokery.com"), "admin@brokery.com");
		await userEvent.type(screen.getByPlaceholderText("Enter your password"), "secret");
		await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

		expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
		expect(login).toHaveBeenCalledWith({ email: "admin@brokery.com", password: "secret" });
		expect(store.getState().auth.token).toBe("t0ken");
	});

	test("brokers land on their clients, not the admin dashboard", async () => {
		vi.mocked(login).mockResolvedValue({
			token: "t0ken",
			user: { _id: "2", name: "Tiya", role: "broker" },
		});
		renderLogin();

		await userEvent.type(screen.getByPlaceholderText("admin@brokery.com"), "tiya@brokery.com");
		await userEvent.type(screen.getByPlaceholderText("Enter your password"), "secret");
		await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

		expect(await screen.findByText("Clients page")).toBeInTheDocument();
	});

	test("shows the server error message on failure", async () => {
		vi.mocked(login).mockRejectedValue({
			response: { data: { message: "Invalid credentials" } },
		});
		renderLogin();

		await userEvent.type(screen.getByPlaceholderText("admin@brokery.com"), "x@y.com");
		await userEvent.type(screen.getByPlaceholderText("Enter your password"), "bad");
		await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

		expect(await screen.findByText("Invalid credentials")).toBeInTheDocument();
	});
});

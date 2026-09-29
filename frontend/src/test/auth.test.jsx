import { render, screen } from "@testing-library/react";
import { Provider } from "react-redux";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AxiosError } from "axios";
import { afterEach, describe, expect, test } from "vitest";
import store from "../store/store";
import { logout, setCredentials } from "../store/authSlice";
import api from "../api/axiosInstance";
import ProtectedRoute from "../components/layout/ProtectedRoute";
import RequireRole from "../components/layout/RequireRole";
import HomeRedirect from "../components/layout/HomeRedirect";

const signIn = (role) => store.dispatch(setCredentials({ token: "t", user: { _id: "1", name: role, role } }));

const renderAt = (path) =>
	render(
		<Provider store={store}>
			<MemoryRouter initialEntries={[path]}>
				<Routes>
					<Route path="/login" element={<p>Login page</p>} />
					<Route element={<ProtectedRoute />}>
						<Route index element={<HomeRedirect />} />
						<Route path="/clients" element={<p>Clients page</p>} />
						<Route element={<RequireRole roles={["admin"]} />}>
							<Route path="/dashboard" element={<p>Dashboard page</p>} />
						</Route>
					</Route>
					<Route path="*" element={<HomeRedirect />} />
				</Routes>
			</MemoryRouter>
		</Provider>,
	);

afterEach(() => {
	store.dispatch(logout());
	api.defaults.adapter = undefined;
});

describe("role-based routing", () => {
	test.each(["/", "/dashboard", "/no-such-page"])("a broker opening %s lands on Clients, never the admin dashboard", (path) => {
		signIn("broker");
		renderAt(path);
		expect(screen.getByText("Clients page")).toBeInTheDocument();
		expect(screen.queryByText("Dashboard page")).not.toBeInTheDocument();
	});

	test("an admin lands on the dashboard", () => {
		signIn("admin");
		renderAt("/");
		expect(screen.getByText("Dashboard page")).toBeInTheDocument();
	});

	test("signed-out users are sent to login", () => {
		renderAt("/clients");
		expect(screen.getByText("Login page")).toBeInTheDocument();
	});
});

describe("expired sessions", () => {
	const respondWith = (status) => {
		api.defaults.adapter = async (config) => {
			const response = { status, statusText: String(status), data: { message: "x" }, headers: {}, config };
			throw new AxiosError("Request failed", "ERR_BAD_REQUEST", config, null, response);
		};
	};

	test("any 401 signs the user out and explains why", async () => {
		signIn("broker");
		respondWith(401);
		await expect(api.get("/clients")).rejects.toBeTruthy();
		expect(store.getState().auth.token).toBeNull();
		expect(store.getState().auth.notice).toMatch(/session has expired/i);
	});

	test("a 403 or a failed login attempt does not sign anyone out", async () => {
		signIn("broker");
		respondWith(403);
		await expect(api.get("/analytics/summary")).rejects.toBeTruthy();
		expect(store.getState().auth.token).toBe("t");

		respondWith(401);
		await expect(api.post("/auth/login", {})).rejects.toBeTruthy();
		expect(store.getState().auth.token).toBe("t");
	});
});

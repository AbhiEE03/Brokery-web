import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, test, vi } from "vitest";
import AlertsBell from "../components/layout/AlertsBell";

const markRead = vi.fn();
const markAllRead = vi.fn();

vi.mock("../hooks/queries", () => ({
	useAlerts: () => ({
		data: {
			data: [
				{
					_id: "a1",
					kind: "new_match",
					title: "New match for Aditya Kulkarni: 2BHK Flat in Baner",
					body: "Price dropped from ₹1.25 Cr to ₹95 L · 92% match",
					href: "/clients/c1",
					readAt: null,
					createdAt: new Date().toISOString(),
				},
				{ _id: "a2", kind: "shortlist_feedback", title: "Bhaskar Bora liked 3BHK Flat in Beltola", readAt: "2026-09-30", createdAt: "2026-09-29" },
			],
			meta: { unreadCount: 1 },
		},
	}),
	useAlertActions: () => ({ markRead: { mutate: markRead }, markAllRead: { mutate: markAllRead } }),
}));

describe("notification bell", () => {
	test("shows the unread count; opening an alert marks it read and navigates", async () => {
		render(
			<MemoryRouter initialEntries={["/clients"]}>
				<Routes>
					<Route path="/clients" element={<AlertsBell />} />
					<Route path="/clients/:id" element={<p>Client page</p>} />
				</Routes>
			</MemoryRouter>,
		);

		const bell = screen.getByRole("button", { name: "Notifications, 1 unread" });
		await userEvent.click(bell);
		expect(screen.getByText(/Price dropped from ₹1.25 Cr to ₹95 L/)).toBeInTheDocument();

		await userEvent.click(screen.getByRole("button", { name: /mark all read/i }));
		expect(markAllRead).toHaveBeenCalled();

		await userEvent.click(screen.getByText(/New match for Aditya Kulkarni/));
		expect(markRead).toHaveBeenCalledWith("a1");
		expect(screen.getByText("Client page")).toBeInTheDocument();
	});
});

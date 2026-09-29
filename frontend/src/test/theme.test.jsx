import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import ThemeProvider from "../theme/ThemeProvider";
import useTheme from "../hooks/useTheme";

const Toggle = () => {
	const { theme, toggleTheme } = useTheme();
	return (
		<button type="button" onClick={toggleTheme}>
			{theme}
		</button>
	);
};

// Two consumers, like App and Sidebar before the fix: they must share one state.
const Reader = () => <p data-testid="reader">{useTheme().theme}</p>;

describe("theme", () => {
	test("starting dark, one toggle switches every consumer and the page to light", async () => {
		localStorage.setItem("theme", "dark");
		render(
			<ThemeProvider>
				<Toggle />
				<Reader />
			</ThemeProvider>,
		);
		expect(document.documentElement).toHaveClass("dark");

		await userEvent.click(screen.getByRole("button"));

		expect(screen.getByRole("button")).toHaveTextContent("light");
		expect(screen.getByTestId("reader")).toHaveTextContent("light");
		expect(document.documentElement).not.toHaveClass("dark");
		expect(localStorage.getItem("theme")).toBe("light");
	});
});

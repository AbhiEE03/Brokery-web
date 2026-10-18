import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test } from "vitest";
import useConfirmDialog from "../hooks/useConfirmDialog";

const Harness = () => {
	const { confirm, dialog } = useConfirmDialog();
	const [result, setResult] = useState("none");
	return (
		<div>
			<button type="button" onClick={async () => setResult(JSON.stringify(await confirm({ title: "Remove?", confirmLabel: "Remove", noteLabel: "Reason" })))}>
				Open
			</button>
			<p>result: {result}</p>
			{dialog}
		</div>
	);
};

describe("confirmation dialog focus", () => {
	test("Tab and Shift+Tab stay inside the dialog", async () => {
		const user = userEvent.setup();
		render(<Harness />);
		await user.click(screen.getByRole("button", { name: "Open" }));
		const dialog = screen.getByRole("dialog");
		expect(dialog).toContainElement(document.activeElement);

		for (let i = 0; i < 6; i += 1) {
			await user.tab();
			expect(dialog).toContainElement(document.activeElement);
		}
		for (let i = 0; i < 6; i += 1) {
			await user.tab({ shift: true });
			expect(dialog).toContainElement(document.activeElement);
		}
	});

	test("closing returns focus to the button that opened it", async () => {
		const user = userEvent.setup();
		render(<Harness />);
		const opener = screen.getByRole("button", { name: "Open" });
		await user.click(opener);
		await user.keyboard("{Escape}");
		expect(screen.queryByRole("dialog")).toBeNull();
		expect(opener).toHaveFocus();
	});
});

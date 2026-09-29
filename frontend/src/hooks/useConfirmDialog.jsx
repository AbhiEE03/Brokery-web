import { useCallback, useState } from "react";
import ConfirmDialog from "../components/ui/ConfirmDialog";

/**
 * Promise-based replacement for window.confirm / window.prompt:
 *
 *   const { confirm, dialog } = useConfirmDialog();
 *   const result = await confirm({ title, message, confirmLabel, tone, noteLabel });
 *   if (!result) return;          // cancelled
 *   result.note                   // text from the optional note field
 *
 * Render {dialog} once in the component.
 */
const useConfirmDialog = () => {
	const [pending, setPending] = useState(null);

	const confirm = useCallback(
		(options) => new Promise((resolve) => setPending({ options, resolve })),
		[],
	);

	const close = useCallback(
		(result) => {
			setPending((current) => {
				current?.resolve(result);
				return null;
			});
		},
		[],
	);

	const dialog = pending ? <ConfirmDialog options={pending.options} onClose={close} /> : null;
	return { confirm, dialog };
};

export default useConfirmDialog;

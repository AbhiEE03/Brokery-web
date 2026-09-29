import { useEffect, useId, useRef, useState } from "react";

const TONES = {
	default: "bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200",
	danger: "bg-rose-600 text-white hover:bg-rose-700",
	success: "bg-emerald-600 text-white hover:bg-emerald-700",
};

const ConfirmDialog = ({ options, onClose }) => {
	const titleId = useId();
	const [note, setNote] = useState("");
	const firstFieldRef = useRef(null);

	useEffect(() => {
		firstFieldRef.current?.focus();
		const onKey = (event) => {
			if (event.key === "Escape") onClose(null);
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	const submit = (event) => {
		event.preventDefault();
		if (options.noteRequired && !note.trim()) return;
		onClose({ note: note.trim() || undefined });
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={() => onClose(null)}>
			<form
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				onSubmit={submit}
				onMouseDown={(event) => event.stopPropagation()}
				className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800"
			>
				<h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-white">
					{options.title}
				</h2>
				{options.message ?
					<p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{options.message}</p>
				:	null}

				{options.noteLabel ?
					<label className="mt-4 block">
						<span className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-300">
							{options.noteLabel}
							{options.noteRequired ? "" : " (optional)"}
						</span>
						<textarea
							ref={firstFieldRef}
							value={note}
							maxLength={500}
							rows={3}
							onChange={(event) => setNote(event.target.value)}
							className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
						/>
					</label>
				:	null}

				<div className="mt-6 flex justify-end gap-3">
					<button
						type="button"
						ref={options.noteLabel ? undefined : firstFieldRef}
						onClick={() => onClose(null)}
						className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={options.noteRequired && !note.trim()}
						className={`rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50 ${TONES[options.tone || "default"]}`}
					>
						{options.confirmLabel || "Confirm"}
					</button>
				</div>
			</form>
		</div>
	);
};

export default ConfirmDialog;

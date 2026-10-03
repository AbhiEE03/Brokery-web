import { useEffect, useId, useState } from "react";

/**
 * Pick the broker who takes over a broker's clients. In "offboard" mode it is
 * the deactivation flow: move the clients first, or deactivate and keep them.
 */
const ReassignDialog = ({ broker, brokers, mode, busy, onConfirm, onDeactivateOnly, onClose }) => {
	const titleId = useId();
	const options = brokers.filter((b) => b.isActive && b._id !== broker._id);
	const [target, setTarget] = useState(options[0]?._id || "");

	useEffect(() => {
		const onKey = (event) => event.key === "Escape" && onClose();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	const offboard = mode === "offboard";
	const count = broker.clientCount;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={onClose}>
			<form
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				onMouseDown={(event) => event.stopPropagation()}
				onSubmit={(event) => {
					event.preventDefault();
					if (target) onConfirm(target);
				}}
				className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800"
			>
				<h2 id={titleId} className="text-lg font-semibold text-slate-900 dark:text-white">
					{offboard ? `Offboard ${broker.name}?` : `Move ${broker.name}'s clients`}
				</h2>
				<p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
					{offboard ?
						`${broker.name} still has ${count} client${count === 1 ? "" : "s"}. Move them to another broker before deactivating, so no buyer is left without an owner.`
					:	`All ${count} client${count === 1 ? "" : "s"} move in one step. Each transfer is recorded in the client's history.`}
				</p>

				{options.length ?
					<label className="mt-4 block">
						<span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">New broker</span>
						<select
							value={target}
							onChange={(event) => setTarget(event.target.value)}
							className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
						>
							{options.map((b) => (
								<option key={b._id} value={b._id}>
									{b.name} ({b.clientCount} clients)
								</option>
							))}
						</select>
					</label>
				:	<p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
						There's no other active broker to take these clients yet.
					</p>
				}

				<div className="mt-6 flex flex-wrap justify-end gap-3">
					<button
						type="button"
						onClick={onClose}
						className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
					>
						Cancel
					</button>
					{offboard ?
						<button
							type="button"
							disabled={busy}
							onClick={onDeactivateOnly}
							className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:text-rose-300"
						>
							Deactivate, keep clients
						</button>
					:	null}
					<button
						type="submit"
						disabled={busy || !target}
						className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-950"
					>
						{offboard ? "Move clients & deactivate" : "Move clients"}
					</button>
				</div>
			</form>
		</div>
	);
};

export default ReassignDialog;

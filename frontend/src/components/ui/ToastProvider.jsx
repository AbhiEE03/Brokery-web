import { useCallback, useMemo, useRef, useState } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { ToastContext } from "./toastContext";

const ICONS = {
	success: <CheckCircle2 size={18} className="text-emerald-500" />,
	error: <XCircle size={18} className="text-rose-500" />,
	info: <Info size={18} className="text-sky-500" />,
};

/**
 * Small, stacked, auto-dismissing notifications (bottom-right), announced to
 * screen readers through a polite live region.
 */
const ToastProvider = ({ children }) => {
	const [toasts, setToasts] = useState([]);
	const nextId = useRef(0);

	const dismiss = useCallback((id) => setToasts((current) => current.filter((t) => t.id !== id)), []);

	const push = useCallback(
		(tone, message, { description, duration = 4000 } = {}) => {
			nextId.current += 1;
			const id = nextId.current;
			setToasts((current) => [...current.slice(-3), { id, tone, message, description }]);
			setTimeout(() => dismiss(id), duration);
		},
		[dismiss],
	);

	const api = useMemo(
		() => ({
			success: (message, options) => push("success", message, options),
			error: (message, options) => push("error", message, options),
			info: (message, options) => push("info", message, options),
		}),
		[push],
	);

	return (
		<ToastContext.Provider value={api}>
			{children}
			<div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
				{toasts.map((toast) => (
					<div
						key={toast.id}
						role="status"
						className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-900/10 animate-[toast-in_160ms_ease-out] dark:border-slate-700 dark:bg-slate-800"
					>
						{ICONS[toast.tone]}
						<div className="min-w-0 flex-1">
							<p className="text-sm font-semibold text-slate-900 dark:text-white">{toast.message}</p>
							{toast.description ?
								<p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{toast.description}</p>
							:	null}
						</div>
						<button
							type="button"
							aria-label="Dismiss"
							onClick={() => dismiss(toast.id)}
							className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
						>
							<X size={14} />
						</button>
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
};

export default ToastProvider;

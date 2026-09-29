import { messageFrom } from "../../utils/errors";

// Consistent loading / empty / error blocks for lists and panels.

export const LoadingState = ({ label = "Loading..." }) => (
	<p role="status" className="px-1 py-6 text-sm text-slate-500 dark:text-slate-400">
		{label}
	</p>
);

export const EmptyState = ({ title, hint }) => (
	<div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-600 dark:bg-slate-800">
		<p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</p>
		{hint ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</p> : null}
	</div>
);

export const ErrorState = ({ error, onRetry }) => (
	<div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
		<span>{messageFrom(error)}</span>
		{onRetry ?
			<button type="button" onClick={onRetry} className="font-semibold underline">
				Try again
			</button>
		:	null}
	</div>
);

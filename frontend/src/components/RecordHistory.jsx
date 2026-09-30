import { History, ShieldCheck } from "lucide-react";
import { useRecordHistory } from "../hooks/queries";
import { EmptyState, ErrorState, LoadingState } from "./ui/States";
import { fieldLabel, formatDateTime, formatFieldValue } from "../utils/format";

const Changes = ({ entry }) => {
	const fields = Object.keys(entry.after || entry.before || {});
	if (!fields.length || !entry.actionCode?.match(/\.(update|create|approved|rejected|conflict|withdrawn)$/)) return null;
	if (entry.actionCode.endsWith(".create")) return null;
	return (
		<ul className="mt-2 space-y-1">
			{fields.map((field) => (
				<li key={field} className="text-xs text-slate-600 dark:text-slate-300">
					<span className="font-semibold">{fieldLabel(field)}:</span>{" "}
					{formatFieldValue(field, entry.before?.[field])} → {formatFieldValue(field, entry.after?.[field])}
				</li>
			))}
		</ul>
	);
};

/**
 * Who changed what on this client/property, newest first, from the audit log.
 */
const RecordHistory = ({ entityId }) => {
	const query = useRecordHistory(entityId, { limit: 15 });
	const entries = query.data?.data || [];

	return (
		<section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8 xl:col-span-2">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">History</p>
					<h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Who changed what</h2>
				</div>
				<span className="inline-flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
					<ShieldCheck size={14} /> From the tamper-evident audit log
				</span>
			</div>

			<div className="mt-6">
				{query.isPending ?
					<LoadingState label="Loading history..." />
				: query.isError ?
					<ErrorState error={query.error} onRetry={query.refetch} />
				: entries.length === 0 ?
					<EmptyState title="No recorded changes yet." hint="Records created before the audit log may have no history." />
				:	<ol className="relative space-y-4 border-l border-slate-200 pl-6 dark:border-slate-700">
						{entries.map((entry) => (
							<li key={entry._id}>
								<span className="absolute -left-[9px] mt-1 flex h-4 w-4 items-center justify-center rounded-full bg-white ring-2 ring-slate-300 dark:bg-slate-800 dark:ring-slate-600">
									<History size={10} className="text-slate-500" />
								</span>
								<p className="text-sm font-medium text-slate-900 dark:text-white">{entry.action}</p>
								<p className="text-xs text-slate-500 dark:text-slate-400">
									{entry.performedBy?.name || (entry.meta?.via === "buyer-link" ? "Buyer, via shortlist link" : "System")} ·{" "}
									{formatDateTime(entry.createdAt)} · #{entry.seq}
									{entry.legacy ? " · imported from the old activity log" : ""}
								</p>
								<Changes entry={entry} />
							</li>
						))}
					</ol>
				}
			</div>
		</section>
	);
};

export default RecordHistory;

import { useSelector } from "react-redux";
import { Filter } from "lucide-react";
import { useActivityLogs, useBrokerOptions } from "../hooks/queries";
import useListState, { useClampedPage } from "../hooks/useListState";
import Pagination from "../components/ui/Pagination";
import { messageFrom } from "../utils/errors";

const PAGE_SIZE = 10;

const entityTypeOptions = [
	"all",
	"client",
	"property",
	"match",
	"change_request",
	"ownership_claim",
	"shortlist",
	"user",
];

const formatRelativeTime = (value) => {
	if (!value) return "Unknown time";

	const timestamp = new Date(value).getTime();
	if (Number.isNaN(timestamp)) return "Unknown time";

	const seconds = Math.round((timestamp - Date.now()) / 1000);
	const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
	const absSeconds = Math.abs(seconds);

	if (absSeconds < 60) return formatter.format(Math.round(seconds), "second");

	const minutes = Math.round(seconds / 60);
	if (Math.abs(minutes) < 60) return formatter.format(minutes, "minute");

	const hours = Math.round(seconds / 3600);
	if (Math.abs(hours) < 24) return formatter.format(hours, "hour");

	const days = Math.round(seconds / 86400);
	if (Math.abs(days) < 30) return formatter.format(days, "day");

	const months = Math.round(seconds / 2592000);
	if (Math.abs(months) < 12) return formatter.format(months, "month");

	const years = Math.round(seconds / 31536000);
	return formatter.format(years, "year");
};

const getInitial = (log) => {
	const name =
		log?.performedBy?.name || log?.performedBy?.email || log?.action || "?";
	return name.trim().charAt(0).toUpperCase();
};

const getAvatarTone = (entity) => {
	switch (entity) {
		case "client":
			return "bg-emerald-100 text-emerald-700";
		case "property":
			return "bg-sky-100 text-sky-700";
		case "match":
			return "bg-amber-100 text-amber-700";
		case "change_request":
			return "bg-rose-100 text-rose-700";
		case "user":
			return "bg-slate-200 text-slate-700";
		default:
			return "bg-slate-100 text-slate-700";
	}
};

const getEntityLabel = (entity) => {
	switch (entity) {
		case "change_request":
			return "change request";
		default:
			return entity?.replace("_", " ") || "unknown";
	}
};

const ActivityLog = () => {
	const user = useSelector((state) => state.auth.user);
	const isAdmin = user?.role === "admin";
	// Filters and page live in the address bar (Back and refresh keep them).
	const list = useListState({ entity: "all" });
	const page = list.page;
	const entityType = list.get("entity");
	const broker = list.get("broker");
	const startDate = list.get("from");
	const endDate = list.get("to");

	const brokers = useBrokerOptions(isAdmin).data || [];
	const query = useActivityLogs({
		page,
		limit: PAGE_SIZE,
		entityType: entityType === "all" ? undefined : entityType,
		broker: isAdmin && broker ? broker : undefined,
		from: startDate || undefined,
		to: endDate || undefined,
	});
	const clamping = useClampedPage(query, page, list);
	const logs = query.data?.data || [];
	const pagination = query.data?.pagination || { page: 1, pages: 1, total: 0 };
	const loading = query.isPending || clamping;
	const error = query.isError ? messageFrom(query.error, "Failed to load activity logs.") : "";

	return (
		<section className="p-6 sm:p-8">
			<div className="flex flex-col gap-6">
				<header className="mb-6 flex flex-col gap-1 border-b border-slate-200 pb-5 dark:border-slate-700 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
							Activity Log
						</h1>
						<p className="mt-1 text-sm text-slate-500 dark:text-slate-400 dark:text-slate-400">
							Everything that's happened in the CRM, newest first.
						</p>
					</div>
					<div className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
						<Filter size={18} />
						{pagination.total ? `${pagination.total} entries` : "Activity feed"}
					</div>
				</header>

				<div className="grid gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm lg:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr] lg:items-center lg:p-5">
					<select
						value={entityType}
						onChange={(event) => list.set({ entity: event.target.value })}
						className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none transition focus:border-slate-400"
					>
						{entityTypeOptions.map((option) => (
							<option key={option} value={option}>
								{option === "all" ? "All entities" : option.replace("_", " ")}
							</option>
						))}
					</select>

					<label className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 px-4 py-3 focus-within:border-slate-400">
						<input
							type="date"
							value={startDate}
							onChange={(event) => list.set({ from: event.target.value })}
							className="w-full bg-transparent text-sm text-slate-950 dark:text-white outline-none"
						/>
					</label>

					<label className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 px-4 py-3 focus-within:border-slate-400">
						<input
							type="date"
							value={endDate}
							onChange={(event) => list.set({ to: event.target.value })}
							className="w-full bg-transparent text-sm text-slate-950 dark:text-white outline-none"
						/>
					</label>

					{isAdmin ?
						<select
							value={broker}
							onChange={(event) => list.set({ broker: event.target.value })}
							className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none transition focus:border-slate-400 xl:col-span-1"
						>
							<option value="">All brokers</option>
							{brokers.map((b) => (
								<option key={b._id} value={b._id}>
									{b.name || b.email}
								</option>
							))}
						</select>
					:	null}
				</div>

				{error ?
					<div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
						{error}
					</div>
				:	null}

				<div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
							<thead className="bg-slate-50 dark:bg-slate-700/50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
								<tr>
									<th className="px-6 py-4">Action</th>
									<th className="px-6 py-4">Entity</th>
									<th className="px-6 py-4">By</th>
									<th className="px-6 py-4">Time</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
								{loading ?
									<tr>
										<td
											className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400"
											colSpan={4}
										>
											Loading activity logs...
										</td>
									</tr>
								: logs.length === 0 ?
									<tr>
										<td
											className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400"
											colSpan={4}
										>
											No activity logs found.
										</td>
									</tr>
								:	logs.map((log) => (
										<tr
											key={log._id}
											className="transition hover:bg-slate-50 dark:hover:bg-slate-700/30"
										>
											<td className="px-6 py-4">
												<div className="flex items-center gap-3">
													<div
														className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold ${getAvatarTone(log.entity)}`}
													>
														{getInitial(log)}
													</div>
													<div>
														<div className="font-medium text-slate-950 dark:text-white">
															{log.action}
														</div>
														<div className="text-sm text-slate-500 dark:text-slate-400">
															{log.performedBy?.name ||
																log.performedBy?.email ||
																"Unknown user"}
														</div>
													</div>
												</div>
											</td>
											<td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 dark:text-slate-400">
												<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
													{getEntityLabel(log.entity)}
												</span>
											</td>
											<td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 dark:text-slate-400">
												{log.performedBy?.role || "Unknown"}
											</td>
											<td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 dark:text-slate-400">
												{formatRelativeTime(log.createdAt)}
											</td>
										</tr>
									))
								}
							</tbody>
						</table>
					</div>

					{logs.length > 0 ?
						<Pagination
							page={pagination.page}
							pages={pagination.pages}
							total={pagination.total}
							limit={PAGE_SIZE}
							onPageChange={(next) => list.set({ page: next })}
						/>
					:	null}
				</div>
			</div>
		</section>
	);
};

export default ActivityLog;

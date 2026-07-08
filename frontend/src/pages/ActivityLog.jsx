import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { ChevronLeft, ChevronRight, Filter } from "lucide-react";
import { getActivityLogs } from "../api/activityApi";

const entityTypeOptions = [
	"all",
	"client",
	"property",
	"match",
	"change_request",
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
	const [logs, setLogs] = useState([]);
	const [pagination, setPagination] = useState({
		page: 1,
		limit: 10,
		total: 0,
		pages: 1,
	});
	const [entityType, setEntityType] = useState("all");
	const [broker, setBroker] = useState("");
	const [startDate, setStartDate] = useState("");
	const [endDate, setEndDate] = useState("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	const queryParams = useMemo(
		() => ({
			page: pagination.page,
			limit: pagination.limit,
			entityType: entityType === "all" ? undefined : entityType,
			broker: isAdmin && broker ? broker : undefined,
			startDate: startDate || undefined,
			endDate: endDate || undefined,
		}),
		[
			pagination.page,
			pagination.limit,
			entityType,
			isAdmin,
			broker,
			startDate,
			endDate,
		],
	);

	useEffect(() => {
		let isMounted = true;

		const loadLogs = async () => {
			setLoading(true);
			setError("");

			try {
				const response = await getActivityLogs(queryParams);
				if (!isMounted) return;
				setLogs(response.data || []);
				setPagination((current) => ({
					...current,
					...(response.pagination || {}),
				}));
			} catch (err) {
				if (!isMounted) return;
				setError(
					err.response?.data?.message || "Failed to load activity logs.",
				);
			} finally {
				if (isMounted) setLoading(false);
			}
		};

		loadLogs();

		return () => {
			isMounted = false;
		};
	}, [queryParams]);

	useEffect(() => {
		setPagination((current) => ({ ...current, page: 1 }));
	}, [entityType, broker, startDate, endDate]);

	return (
		<section className="p-6 sm:p-8">
			<div className="flex flex-col gap-6">
				<header className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm sm:p-8 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
							Activity records
						</p>
						<h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
							Activity Log
						</h1>
						<p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
							Review recent CRM actions, filter by entity type, and inspect who
							performed each change.
						</p>
					</div>
					<div className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
						<Filter size={18} />
						{pagination.total ? `${pagination.total} entries` : "Activity feed"}
					</div>
				</header>

				<div className="grid gap-4 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr] lg:items-center lg:p-5">
					<select
						value={entityType}
						onChange={(event) => setEntityType(event.target.value)}
						className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400"
					>
						{entityTypeOptions.map((option) => (
							<option key={option} value={option}>
								{option === "all" ? "All entities" : option.replace("_", " ")}
							</option>
						))}
					</select>

					<label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-slate-400">
						<input
							type="date"
							value={startDate}
							onChange={(event) => setStartDate(event.target.value)}
							className="w-full bg-transparent text-sm text-slate-950 outline-none"
						/>
					</label>

					<label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-slate-400">
						<input
							type="date"
							value={endDate}
							onChange={(event) => setEndDate(event.target.value)}
							className="w-full bg-transparent text-sm text-slate-950 outline-none"
						/>
					</label>

					{isAdmin ?
						<label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-slate-400 xl:col-span-1">
							<input
								type="text"
								value={broker}
								onChange={(event) => setBroker(event.target.value)}
								placeholder="Broker ID"
								className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
							/>
						</label>
					:	null}
				</div>

				{error ?
					<div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
						{error}
					</div>
				:	null}

				<div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-slate-200">
							<thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
								<tr>
									<th className="px-6 py-4">Action</th>
									<th className="px-6 py-4">Entity</th>
									<th className="px-6 py-4">By</th>
									<th className="px-6 py-4">Time</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100 bg-white">
								{loading ?
									<tr>
										<td
											className="px-6 py-8 text-sm text-slate-500"
											colSpan={4}
										>
											Loading activity logs...
										</td>
									</tr>
								: logs.length === 0 ?
									<tr>
										<td
											className="px-6 py-8 text-sm text-slate-500"
											colSpan={4}
										>
											No activity logs found.
										</td>
									</tr>
								:	logs.map((log) => (
										<tr key={log._id} className="transition hover:bg-slate-50">
											<td className="px-6 py-4">
												<div className="flex items-center gap-3">
													<div
														className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold ${getAvatarTone(log.entity)}`}
													>
														{getInitial(log)}
													</div>
													<div>
														<div className="font-medium text-slate-950">
															{log.action}
														</div>
														<div className="text-sm text-slate-500">
															{log.performedBy?.name ||
																log.performedBy?.email ||
																"Unknown user"}
														</div>
													</div>
												</div>
											</td>
											<td className="px-6 py-4 text-sm text-slate-600">
												<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
													{getEntityLabel(log.entity)}
												</span>
											</td>
											<td className="px-6 py-4 text-sm text-slate-600">
												{log.performedBy?.role || "Unknown"}
											</td>
											<td className="px-6 py-4 text-sm text-slate-600">
												{formatRelativeTime(log.createdAt)}
											</td>
										</tr>
									))
								}
							</tbody>
						</table>
					</div>

					<div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
						<p className="text-sm text-slate-600">
							Page {pagination.page} of {pagination.pages || 1}
						</p>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() =>
									setPagination((current) => ({
										...current,
										page: Math.max(1, current.page - 1),
									}))
								}
								disabled={pagination.page <= 1}
								className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
							>
								<ChevronLeft size={16} />
								Prev
							</button>
							<button
								type="button"
								onClick={() =>
									setPagination((current) => ({
										...current,
										page: Math.min(current.pages || 1, current.page + 1),
									}))
								}
								disabled={pagination.page >= (pagination.pages || 1)}
								className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
							>
								Next
								<ChevronRight size={16} />
							</button>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
};

export default ActivityLog;

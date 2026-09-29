import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { CheckCircle, ChevronLeft, ChevronRight, Undo2, XCircle } from "lucide-react";
import {
	approveChangeRequest,
	getChangeRequests,
	rejectChangeRequest,
	withdrawChangeRequest,
} from "../api/changeRequestApi";

const entityTypeOptions = ["all", "client", "property"];
const statusOptions = ["all", "pending", "approved", "rejected", "conflict", "superseded", "withdrawn"];

const STATUS_BADGE = {
	approved: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
	rejected: "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400",
	conflict: "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
	superseded: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
	withdrawn: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
	pending: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
};

const formatValue = (value, field = "") => {
	if (value === null || value === undefined || value === "") return "—";
	if (typeof value === "object") return JSON.stringify(value);
	const isCurrency =
		/budget|price|Budget|Price/.test(field);
	if (isCurrency && !isNaN(Number(value))) {
		return Number(value).toLocaleString("en-IN", {
			style: "currency",
			currency: "INR",
			maximumFractionDigits: 0,
		});
	}
	return String(value);
};

const FIELD_LABELS = {
	pipelineStage: "Pipeline Stage",
	"requirements.city": "City",
	"requirements.minBudget": "Min Budget",
	"requirements.maxBudget": "Max Budget",
	"requirements.minArea": "Min Area (sq ft)",
	"requirements.maxArea": "Max Area (sq ft)",
	"requirements.bedrooms": "Bedrooms",
	"requirements.propertyType": "Property Type",
	askingPrice: "Asking Price",
	"location.city": "City",
	"location.locality": "Locality",
	"pricing.askingPrice": "Asking Price",
	"pricing.pricePerSqft": "Price per sq ft",
	"specs.area": "Area (sq ft)",
	"specs.bedrooms": "Bedrooms",
	assignedBroker: "Assigned Broker",
	status: "Listing Status",
	propertyType: "Property Type",
};

const formatLabel = (value) => {
	if (!value) return "Unknown";
	if (FIELD_LABELS[value]) return FIELD_LABELS[value];
	// Fallback: split dot-notation, split camelCase, capitalise each word
	return value
		.split(".")
		.map((segment) =>
			segment
				.replace(/([A-Z])/g, " $1")
				.replace(/^./, (c) => c.toUpperCase())
				.trim(),
		)
		.join(" ");
};

const formatDate = (value) => {
	if (!value) return "Unknown date";
	return new Date(value).toLocaleString("en-IN", {
		dateStyle: "medium",
		timeStyle: "short",
	});
};

const ChangeRequests = () => {
	const user = useSelector((state) => state.auth.user);
	const isAdmin = user?.role === "admin";
	const [requests, setRequests] = useState([]);
	const [pagination, setPagination] = useState({
		page: 1,
		limit: 10,
		total: 0,
		pages: 1,
	});
	const [entityType, setEntityType] = useState("all");
	const [status, setStatus] = useState(isAdmin ? "pending" : "all");
	const [refreshKey, setRefreshKey] = useState(0);
	const [startDate, setStartDate] = useState("");
	const [endDate, setEndDate] = useState("");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [resolvingId, setResolvingId] = useState("");

	const queryParams = useMemo(
		() => ({
			page: pagination.page,
			limit: pagination.limit,
			entityType: entityType === "all" ? undefined : entityType,
			status: status === "all" ? undefined : status,
			from: startDate || undefined,
			to: endDate || undefined,
		}),
		[pagination.page, pagination.limit, entityType, status, startDate, endDate],
	);

	useEffect(() => {
		let isMounted = true;

		const loadChangeRequests = async () => {
			setLoading(true);
			setError("");

			try {
				const response = await getChangeRequests(queryParams);
				if (!isMounted) return;

				setRequests(response.data || []);
				setPagination((current) => ({
					...current,
					...(response.pagination || {}),
				}));
			} catch (err) {
				if (!isMounted) return;
				setError(
					err.response?.data?.message || "Failed to load change requests.",
				);
			} finally {
				if (isMounted) setLoading(false);
			}
		};

		loadChangeRequests();

		return () => {
			isMounted = false;
		};
	}, [queryParams, refreshKey]);

	useEffect(() => {
		setPagination((current) => ({ ...current, page: 1 }));
	}, [entityType, status, startDate, endDate]);

	const handleResolve = async (requestId, action) => {
		const confirmText = {
			approved: "Approve this change request?",
			rejected: "Reject this change request?",
			withdrawn: "Withdraw this change request?",
		}[action];
		if (!window.confirm(confirmText)) return;

		let adminNote;
		if (action === "rejected") {
			adminNote = window.prompt("Enter a rejection reason (optional):", "") || undefined;
		}

		setResolvingId(requestId);
		setError("");

		try {
			if (action === "approved") await approveChangeRequest(requestId, adminNote);
			else if (action === "rejected") await rejectChangeRequest(requestId, adminNote);
			else await withdrawChangeRequest(requestId);
		} catch (err) {
			setError(
				err.response?.data?.message || "Unable to update change request.",
			);
		} finally {
			setResolvingId("");
			setRefreshKey((key) => key + 1);
		}
	};

	const renderEntityType = (request) =>
		(request.entityType || "unknown").toUpperCase();

	const renderEntityName = (request) => {
		const entity = request.entityId;
		if (!entity) return "Deleted record";
		const code = entity.clientCode || entity.propertyCode;
		const name = entity.name || entity.title;
		return code ? `${name} · ${code}` : name;
	};

	return (
		<section className="p-6 sm:p-8">
			<div className="flex flex-col gap-6">
				<header className="mb-6 flex flex-col gap-1 border-b border-slate-200 pb-5 dark:border-slate-700 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
							Change Requests
						</h1>
						<p className="mt-1 text-sm text-slate-500 dark:text-slate-400 dark:text-slate-400">
							Brokers can't change pipeline stage or budget directly. Those edits land here for you to review.
						</p>
					</div>
					<div className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
						{isAdmin ? "My queue" : "My requests"}
					</div>
				</header>

				<div className="grid gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4 lg:items-center lg:p-5">
					<select
						value={status}
						onChange={(event) => setStatus(event.target.value)}
						aria-label="Status"
						className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none transition focus:border-slate-400"
					>
						{statusOptions.map((option) => (
							<option key={option} value={option}>
								{option === "all" ? "All statuses" : option}
							</option>
						))}
					</select>

					<select
						value={entityType}
						onChange={(event) => setEntityType(event.target.value)}
						className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none transition focus:border-slate-400"
					>
						{entityTypeOptions.map((option) => (
							<option key={option} value={option}>
								{option === "all" ? "All entities" : option.replace("_", " ")}
							</option>
						))}
					</select>

					<label className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 px-4 py-3 focus-within:border-slate-400">
						<input
							type="date"
							value={startDate}
							onChange={(event) => setStartDate(event.target.value)}
							className="w-full bg-transparent text-sm text-slate-950 dark:text-white outline-none"
						/>
					</label>

					<label className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 px-4 py-3 focus-within:border-slate-400">
						<input
							type="date"
							value={endDate}
							onChange={(event) => setEndDate(event.target.value)}
							className="w-full bg-transparent text-sm text-slate-950 dark:text-white outline-none"
						/>
					</label>
				</div>

				{error ?
					<div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
						{error}
					</div>
				:	null}

				<div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-slate-200">
							<thead className="bg-slate-50 dark:bg-slate-700/50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
								<tr>
									<th className="px-6 py-4">Request</th>
									<th className="px-6 py-4">Details</th>
									<th className="px-6 py-4">Requested By</th>
									<th className="px-6 py-4">Status</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
								{loading ?
									<tr>
										<td
											className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400"
											colSpan={4}
										>
											Loading change requests...
										</td>
									</tr>
								: requests.length === 0 ?
									<tr>
										<td
											className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400"
											colSpan={4}
										>
											No change requests found.
										</td>
									</tr>
								:	requests.map((request) => (
										<tr
											key={request._id}
											className="align-top transition hover:bg-slate-50 dark:hover:bg-slate-700/30"
										>
											<td className="px-6 py-4">
												<div className="flex flex-col gap-3">
													<div className="flex flex-wrap items-center gap-2">
														<span className="rounded-full bg-slate-100 dark:bg-slate-700 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 dark:text-slate-300">
															{renderEntityType(request)}
														</span>
														{request.status ?
															<span
																className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
																	STATUS_BADGE[request.status] || STATUS_BADGE.pending
																}`}
															>
																{request.status}
															</span>
														:	null}
													</div>
													<div className="text-sm text-slate-500 dark:text-slate-400 dark:text-slate-400">
														{renderEntityName(request)}
													</div>
														{request.status === "conflict" && request.conflictFields?.length ?
															<p className="text-xs text-orange-700 dark:text-orange-400">
																Not applied: {request.conflictFields.map(formatLabel).join(", ")} changed after this request was made.
															</p>
														:	null}
														{request.adminNote ?
															<p className="text-xs text-slate-500 dark:text-slate-400">
																Note: {request.adminNote}
															</p>
														:	null}
												</div>
											</td>
											<td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
												<div className="flex flex-col gap-3">
													{(request.changes || []).map((change) => (
														<div
															key={`${request._id}-${change.field}`}
															className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 px-4 py-3"
														>
															<div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
																{formatLabel(change.field)}
															</div>
															<div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
																<span className="rounded-full bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 px-3 py-1 font-medium text-rose-700 dark:text-rose-400">
																	{formatValue(change.oldValue, change.field)}
																</span>
																<span className="font-semibold text-slate-400">
																	→
																</span>
																<span className="rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-1 font-medium text-emerald-700 dark:text-emerald-400">
																	{formatValue(change.newValue, change.field)}
																</span>
															</div>
														</div>
													))}
												</div>
											</td>
											<td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
												<div className="font-medium text-slate-950 dark:text-white">
													{request.requestedBy?.name ||
														request.requestedBy?.email ||
														"Unknown user"}
												</div>
												<div className="mt-1 text-slate-500 dark:text-slate-400">
													{formatDate(request.createdAt)}
												</div>
											</td>
											<td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
												{isAdmin ?
													request.status === "pending" ?
														<div className="flex flex-col gap-2">
															<button
																type="button"
																onClick={() =>
																	handleResolve(request._id, "approved")
																}
																disabled={resolvingId === request._id}
																className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
															>
																{resolvingId === request._id ?
																	"Working..."
																:	<><CheckCircle size={16} />Approve</>}
															</button>
															<button
																type="button"
																onClick={() =>
																	handleResolve(request._id, "rejected")
																}
																disabled={resolvingId === request._id}
																className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
															>
																<XCircle size={16} />Reject
															</button>
														</div>
													:	<span className="text-slate-400">Resolved</span>
												:	request.status === "pending" ?
													<button
														type="button"
														onClick={() => handleResolve(request._id, "withdrawn")}
														disabled={resolvingId === request._id}
														className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
													>
														<Undo2 size={16} />Withdraw
													</button>
												:	<span className="text-slate-400">Closed</span>
												}
											</td>
										</tr>
									))
								}
							</tbody>
						</table>
					</div>

					<div className="flex items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 px-6 py-4">
						<p className="text-sm text-slate-600 dark:text-slate-400">
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
								className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
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
								className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
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

export default ChangeRequests;

import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
	getChangeRequests,
	resolveChangeRequest,
} from "../api/changeRequestApi";

const entityTypeOptions = ["all", "client", "property"];
const statusOptions = ["pending", "approved", "rejected"];

const formatValue = (value) => {
	if (value === null || value === undefined || value === "") return "—";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value);
};

const formatLabel = (value) => {
	if (!value) return "Unknown";
	return value
		.replaceAll(".", " ")
		.replaceAll("_", " ")
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
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
			startDate: startDate || undefined,
			endDate: endDate || undefined,
		}),
		[pagination.page, pagination.limit, entityType, startDate, endDate],
	);

	useEffect(() => {
		let isMounted = true;

		const loadChangeRequests = async () => {
			setLoading(true);
			setError("");

			try {
				const response = await getChangeRequests(queryParams);
				if (!isMounted) return;

				const allRequests = response.data || [];
				const filteredRequests =
					isAdmin ?
						allRequests.filter((item) => item.status === "pending")
					:	allRequests;

				const total = filteredRequests.length;
				const pages = Math.max(1, Math.ceil(total / pagination.limit));
				const page = Math.min(pagination.page, pages);
				const start = (page - 1) * pagination.limit;
				const pagedRequests = filteredRequests.slice(
					start,
					start + pagination.limit,
				);

				setRequests(pagedRequests);
				setPagination((current) => ({
					...current,
					page,
					total,
					pages,
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
	}, [queryParams, isAdmin, pagination.limit, pagination.page]);

	useEffect(() => {
		setPagination((current) => ({ ...current, page: 1 }));
	}, [entityType, startDate, endDate]);

	const handleResolve = async (requestId, action) => {
		const shouldProceed = window.confirm(
			action === "approved" ?
				"Approve this change request?"
			:	"Reject this change request?",
		);

		if (!shouldProceed) return;

		let rejectionReason = "";
		if (action === "rejected") {
			rejectionReason =
				window.prompt("Enter a rejection reason (optional):", "") || "";
		}

		setResolvingId(requestId);
		setError("");

		try {
			await resolveChangeRequest(requestId, action, rejectionReason);
			const response = await getChangeRequests({
				page: 1,
				limit: pagination.limit,
				entityType: entityType === "all" ? undefined : entityType,
				startDate: startDate || undefined,
				endDate: endDate || undefined,
			});

			const allRequests = response.data || [];
			const filteredRequests =
				isAdmin ?
					allRequests.filter((item) => item.status === "pending")
				:	allRequests;
			const total = filteredRequests.length;
			const pages = Math.max(1, Math.ceil(total / pagination.limit));

			setRequests(filteredRequests.slice(0, pagination.limit));
			setPagination((current) => ({
				...current,
				page: 1,
				total,
				pages,
			}));
		} catch (err) {
			setError(
				err.response?.data?.message || "Unable to resolve change request.",
			);
		} finally {
			setResolvingId("");
		}
	};

	const renderEntityType = (request) => {
		if (request.client) return "CLIENT";
		if (request.property) return "PROPERTY";
		return "UNKNOWN";
	};

	return (
		<section className="p-6 sm:p-8">
			<div className="flex flex-col gap-6">
				<header className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm sm:p-8 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
							Approval queue
						</p>
						<h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
							Change Requests
						</h1>
						<p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
							Review requested edits, compare old and new values, and approve or
							reject sensitive updates.
						</p>
					</div>
					<div className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white">
						{isAdmin ? "Admin review" : "My requests"}
					</div>
				</header>

				<div className="grid gap-4 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr] lg:items-center lg:p-5">
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
									<th className="px-6 py-4">Request</th>
									<th className="px-6 py-4">Details</th>
									<th className="px-6 py-4">Requested By</th>
									<th className="px-6 py-4">Status</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100 bg-white">
								{loading ?
									<tr>
										<td
											className="px-6 py-8 text-sm text-slate-500"
											colSpan={4}
										>
											Loading change requests...
										</td>
									</tr>
								: requests.length === 0 ?
									<tr>
										<td
											className="px-6 py-8 text-sm text-slate-500"
											colSpan={4}
										>
											No change requests found.
										</td>
									</tr>
								:	requests.map((request) => (
										<tr
											key={request._id}
											className="align-top transition hover:bg-slate-50"
										>
											<td className="px-6 py-4">
												<div className="flex flex-col gap-3">
													<div className="flex flex-wrap items-center gap-2">
														<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
															{renderEntityType(request)}
														</span>
														{request.status ?
															<span
																className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
																	request.status === "approved" ?
																		"bg-emerald-50 text-emerald-700"
																	: request.status === "rejected" ?
																		"bg-rose-50 text-rose-700"
																	:	"bg-amber-50 text-amber-700"
																}`}
															>
																{request.status}
															</span>
														:	null}
													</div>
													<div className="text-sm text-slate-500">
														{request.client?.name ||
															request.property?.title ||
															"Unknown entity"}
													</div>
												</div>
											</td>
											<td className="px-6 py-4 text-sm text-slate-600">
												<div className="flex flex-col gap-3">
													{(request.changes || []).map((change) => (
														<div
															key={`${request._id}-${change.field}`}
															className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
														>
															<div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
																{formatLabel(change.field)}
															</div>
															<div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
																<span className="rounded-full bg-rose-50 px-3 py-1 font-medium text-rose-700">
																	{formatValue(change.oldValue)}
																</span>
																<span className="font-semibold text-slate-400">
																	→
																</span>
																<span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-emerald-700">
																	{formatValue(change.newValue)}
																</span>
															</div>
														</div>
													))}
												</div>
											</td>
											<td className="px-6 py-4 text-sm text-slate-600">
												<div className="font-medium text-slate-950">
													{request.requestedBy?.name ||
														request.requestedBy?.email ||
														"Unknown user"}
												</div>
												<div className="mt-1 text-slate-500">
													{formatDate(request.createdAt)}
												</div>
											</td>
											<td className="px-6 py-4 text-sm text-slate-600">
												{isAdmin ?
													request.status === "pending" ?
														<div className="flex flex-col gap-2">
															<button
																type="button"
																onClick={() =>
																	handleResolve(request._id, "approved")
																}
																disabled={resolvingId === request._id}
																className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
															>
																{resolvingId === request._id ?
																	"Working..."
																:	"Approve"}
															</button>
															<button
																type="button"
																onClick={() =>
																	handleResolve(request._id, "rejected")
																}
																disabled={resolvingId === request._id}
																className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-70"
															>
																Reject
															</button>
														</div>
													:	<span className="text-slate-400">Resolved</span>
												:	<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
														{request.status || "pending"}
													</span>
												}
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

export default ChangeRequests;

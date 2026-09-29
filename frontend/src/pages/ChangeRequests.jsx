import { useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { CheckCircle, Undo2, XCircle } from "lucide-react";
import { useChangeRequestDecision, useChangeRequests } from "../hooks/queries";
import useConfirmDialog from "../hooks/useConfirmDialog";
import Pagination from "../components/ui/Pagination";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { messageFrom } from "../utils/errors";
import { fieldLabel, formatDateTime, formatFieldValue } from "../utils/format";

const STATUS_BADGE = {
	approved: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
	rejected: "bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400",
	conflict: "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
	superseded: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
	withdrawn: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
	pending: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
};

const ADMIN_TABS = [
	{ key: "pending", label: "Pending", status: "pending", empty: "Nothing waiting for review." },
	{ key: "conflict", label: "Conflicts", status: "conflict", empty: "No conflicts. Approvals applied cleanly." },
	{ key: "history", label: "History", status: "resolved", empty: "No decisions yet." },
];

const BROKER_TABS = [
	{ key: "pending", label: "Waiting", status: "pending", empty: "You have no requests waiting for approval." },
	{ key: "history", label: "History", status: "resolved", empty: "No decided requests yet." },
];

const inputClass =
	"rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-700/50 dark:text-slate-300";

const Pill = ({ tone, children }) => {
	const tones = {
		old: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/20 dark:text-rose-400",
		new: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-400",
		now: "border-orange-300 bg-orange-50 text-orange-800 dark:border-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
	};
	return <span className={`rounded-full border px-3 py-1 text-sm font-medium ${tones[tone]}`}>{children}</span>;
};

const ChangeRow = ({ request, change }) => {
	const isConflict = request.status === "conflict";
	const current = request.currentValues?.[change.field];
	const conflicted = isConflict && request.conflictFields?.includes(change.field);

	return (
		<div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-700/50">
			<div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
				{fieldLabel(change.field)}
			</div>
			{isConflict && request.currentValues ?
				<div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
					<div>
						<p className="mb-1 text-slate-500 dark:text-slate-400">Requester saw</p>
						<Pill tone="old">{formatFieldValue(change.field, change.oldValue)}</Pill>
					</div>
					<div>
						<p className="mb-1 text-slate-500 dark:text-slate-400">Now{conflicted ? " (changed since)" : ""}</p>
						<Pill tone={conflicted ? "now" : "old"}>{formatFieldValue(change.field, current)}</Pill>
					</div>
					<div>
						<p className="mb-1 text-slate-500 dark:text-slate-400">Requested</p>
						<Pill tone="new">{formatFieldValue(change.field, change.newValue)}</Pill>
					</div>
				</div>
			:	<div className="mt-2 flex flex-wrap items-center gap-2">
					<Pill tone="old">{formatFieldValue(change.field, change.oldValue)}</Pill>
					<span className="font-semibold text-slate-400">→</span>
					<Pill tone="new">{formatFieldValue(change.field, change.newValue)}</Pill>
				</div>
			}
		</div>
	);
};

const entityLink = (request) => {
	const entity = request.entityId;
	if (!entity) return <span className="text-slate-400">Deleted record</span>;
	const path = request.entityType === "client" ? `/clients/${entity._id}` : `/properties/${entity._id}`;
	const code = entity.clientCode || entity.propertyCode;
	return (
		<Link to={path} className="font-semibold text-slate-900 hover:underline dark:text-white">
			{entity.name || entity.title}
			{code ? ` · ${code}` : ""}
		</Link>
	);
};

const ChangeRequests = () => {
	const user = useSelector((state) => state.auth.user);
	const isAdmin = user?.role === "admin";
	const tabs = isAdmin ? ADMIN_TABS : BROKER_TABS;

	const [tabKey, setTabKey] = useState("pending");
	const [entityType, setEntityType] = useState("");
	const [from, setFrom] = useState("");
	const [to, setTo] = useState("");
	const [page, setPage] = useState(1);
	const [actionError, setActionError] = useState("");
	const { confirm, dialog } = useConfirmDialog();

	const tab = tabs.find((t) => t.key === tabKey) || tabs[0];
	const query = useChangeRequests({ status: tab.status, entityType, from, to, page, limit: 10 });
	const decide = useChangeRequestDecision();
	const requests = query.data?.data || [];
	const pagination = query.data?.pagination || { page: 1, pages: 1 };

	const changeFilter = (setter) => (event) => {
		setter(event.target.value);
		setPage(1);
	};

	const handleAction = async (request, action) => {
		const fields = request.changes.map((c) => fieldLabel(c.field)).join(", ");
		const options = {
			approve: {
				title: "Approve this change?",
				message: `${fields} will be updated. If any of these fields changed since the request was made, it will be marked as a conflict instead.`,
				confirmLabel: "Approve",
				tone: "success",
				noteLabel: "Note to the broker",
			},
			reject: {
				title: "Reject this change?",
				message: `The broker will be told that ${fields} stays as it is.`,
				confirmLabel: "Reject",
				tone: "danger",
				noteLabel: "Reason",
			},
			withdraw: {
				title: "Withdraw your request?",
				message: `Your requested change to ${fields} will be cancelled.`,
				confirmLabel: "Withdraw",
			},
		}[action];

		const result = await confirm(options);
		if (!result) return;
		setActionError("");
		decide.mutate(
			{ id: request._id, action, note: result.note },
			{ onError: (error) => setActionError(messageFrom(error, "Unable to update the change request.")) },
		);
	};

	return (
		<section className="p-6 sm:p-8">
			{dialog}
			<div className="flex flex-col gap-6">
				<header className="flex flex-col gap-1 border-b border-slate-200 pb-5 dark:border-slate-700">
					<h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Change Requests</h1>
					<p className="text-sm text-slate-500 dark:text-slate-400">
						{isAdmin ?
							"Sensitive edits by brokers (stage, budget, city, price…) wait here for your decision."
						:	"Your edits to sensitive fields wait here for an admin's decision."}
					</p>
				</header>

				<div role="tablist" aria-label="Change request views" className="flex flex-wrap gap-2">
					{tabs.map((t) => (
						<button
							key={t.key}
							type="button"
							role="tab"
							aria-selected={t.key === tab.key}
							onClick={() => {
								setTabKey(t.key);
								setPage(1);
							}}
							className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
								t.key === tab.key ?
									"bg-slate-950 text-white dark:bg-white dark:text-slate-950"
								:	"border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
							}`}
						>
							{t.label}
						</button>
					))}
				</div>

				<div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:grid-cols-3">
					<select value={entityType} onChange={changeFilter(setEntityType)} aria-label="Record type" className={inputClass}>
						<option value="">Clients and properties</option>
						<option value="client">Clients</option>
						<option value="property">Properties</option>
					</select>
					<input type="date" value={from} onChange={changeFilter(setFrom)} aria-label="From date" className={inputClass} />
					<input type="date" value={to} onChange={changeFilter(setTo)} aria-label="To date" className={inputClass} />
				</div>

				{actionError ? <ErrorState error={actionError} /> : null}
				{query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : null}

				{query.isPending ?
					<LoadingState label="Loading change requests..." />
				: requests.length === 0 ?
					<EmptyState title={tab.empty} />
				:	<div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
						<ul className="divide-y divide-slate-100 dark:divide-slate-700">
							{requests.map((request) => (
								<li key={request._id} className="grid gap-4 px-6 py-5 lg:grid-cols-[1fr_2fr_auto]">
									<div className="flex flex-col gap-2">
										<div className="flex flex-wrap items-center gap-2">
											<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700 dark:bg-slate-700 dark:text-slate-300">
												{request.entityType}
											</span>
											<span
												className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${STATUS_BADGE[request.status] || STATUS_BADGE.pending}`}
											>
												{request.status}
											</span>
										</div>
										<div className="text-sm">{entityLink(request)}</div>
										<p className="text-xs text-slate-500 dark:text-slate-400">
											Requested by {request.requestedBy?.name || "unknown"} · {formatDateTime(request.createdAt)}
										</p>
										{request.resolvedAt ?
											<p className="text-xs text-slate-500 dark:text-slate-400">
												{request.status === "withdrawn" ? "Withdrawn" : `Decided by ${request.resolvedBy?.name || "admin"}`} ·{" "}
												{formatDateTime(request.resolvedAt)}
											</p>
										:	null}
										{request.status === "conflict" ?
											<p className="text-xs text-orange-700 dark:text-orange-400">
												Not applied: {request.conflictFields?.map(fieldLabel).join(", ")} changed after the request was
												made. Ask the broker to submit it again if it's still wanted.
											</p>
										:	null}
										{request.adminNote ?
											<p className="text-xs text-slate-500 dark:text-slate-400">Note: {request.adminNote}</p>
										:	null}
									</div>

									<div className="flex flex-col gap-3">
										{request.changes.map((change) => (
											<ChangeRow key={change.field} request={request} change={change} />
										))}
									</div>

									<div className="flex flex-row gap-2 lg:flex-col">
										{request.status === "pending" && isAdmin ?
											<>
												<button
													type="button"
													onClick={() => handleAction(request, "approve")}
													disabled={decide.isPending}
													className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
												>
													<CheckCircle size={16} />
													Approve
												</button>
												<button
													type="button"
													onClick={() => handleAction(request, "reject")}
													disabled={decide.isPending}
													className="inline-flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-700 disabled:opacity-60"
												>
													<XCircle size={16} />
													Reject
												</button>
											</>
										: request.status === "pending" ?
											<button
												type="button"
												onClick={() => handleAction(request, "withdraw")}
												disabled={decide.isPending}
												className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
											>
												<Undo2 size={16} />
												Withdraw
											</button>
										:	null}
									</div>
								</li>
							))}
						</ul>
						<Pagination page={pagination.page} pages={pagination.pages} total={pagination.total} onPageChange={setPage} />
					</div>
				}
			</div>
		</section>
	);
};

export default ChangeRequests;

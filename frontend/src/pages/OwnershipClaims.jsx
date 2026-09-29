import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ShieldCheck, UserCheck } from "lucide-react";
import { getOwnershipClaims, resolveOwnershipClaim } from "../api/ownershipApi";

const statusOptions = ["open", "upheld", "transferred", "all"];

const STATUS_BADGE = {
	open: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
	upheld: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
	transferred: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
};

const STATUS_LABEL = { open: "open", upheld: "kept by owner", transferred: "transferred" };

const formatDateTime = (value) =>
	value ?
		new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
	:	"—";

const Person = ({ label, user, time, timeLabel }) => (
	<div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-700/50">
		<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
		<p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{user?.name || "Unassigned"}</p>
		<p className="text-xs text-slate-500 dark:text-slate-400">{user?.email || ""}</p>
		<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
			{timeLabel}: {formatDateTime(time)}
		</p>
	</div>
);

const OwnershipClaims = () => {
	const [status, setStatus] = useState("open");
	const [claims, setClaims] = useState([]);
	const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [resolvingId, setResolvingId] = useState("");
	const [refreshKey, setRefreshKey] = useState(0);

	useEffect(() => {
		let isMounted = true;
		const load = async () => {
			setLoading(true);
			setError("");
			try {
				const response = await getOwnershipClaims({
					page: pagination.page,
					limit: pagination.limit,
					status: status === "all" ? undefined : status,
				});
				if (!isMounted) return;
				setClaims(response.data || []);
				setPagination((current) => ({ ...current, ...(response.pagination || {}) }));
			} catch (err) {
				if (isMounted) setError(err.response?.data?.message || "Failed to load ownership claims.");
			} finally {
				if (isMounted) setLoading(false);
			}
		};
		load();
		return () => {
			isMounted = false;
		};
	}, [status, pagination.page, pagination.limit, refreshKey]);

	const handleResolve = async (claim, decision) => {
		const clientName = claim.existingClient?.name || "this client";
		const question =
			decision === "transfer" ?
				`Transfer ${clientName} to ${claim.claimant?.name}?`
			:	`Keep ${clientName} with ${claim.existingBroker?.name || "the current broker"}?`;
		if (!window.confirm(question)) return;
		const note = window.prompt("Add a note for the record (optional):", "") || undefined;

		setResolvingId(claim._id);
		setError("");
		setNotice("");
		try {
			const response = await resolveOwnershipClaim(claim._id, decision, note);
			setNotice(response.message);
		} catch (err) {
			setError(err.response?.data?.message || "Unable to resolve the claim.");
		} finally {
			setResolvingId("");
			setRefreshKey((key) => key + 1);
		}
	};

	return (
		<section className="p-6 sm:p-8">
			<div className="flex flex-col gap-6">
				<header className="flex flex-col gap-3 border-b border-slate-200 pb-5 dark:border-slate-700 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Ownership Claims</h1>
						<p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">
							A broker tried to register a buyer whose phone number another broker already has. They were only
							told the client exists. Decide who keeps the buyer.
						</p>
					</div>
					<select
						value={status}
						onChange={(event) => {
							setStatus(event.target.value);
							setPagination((current) => ({ ...current, page: 1 }));
						}}
						aria-label="Status"
						className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-700/50 dark:text-slate-300"
					>
						{statusOptions.map((option) => (
							<option key={option} value={option}>
								{option === "all" ? "All claims" : STATUS_LABEL[option]}
							</option>
						))}
					</select>
				</header>

				{error ?
					<div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
				:	null}
				{notice ?
					<div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
						{notice}
					</div>
				:	null}

				{loading ?
					<p className="text-sm text-slate-500 dark:text-slate-400">Loading claims...</p>
				: claims.length === 0 ?
					<div className="rounded-xl border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
						No {status === "all" ? "" : STATUS_LABEL[status]} claims.
					</div>
				:	<div className="flex flex-col gap-4">
						{claims.map((claim) => (
							<article
								key={claim._id}
								className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
							>
								<div className="flex flex-wrap items-center justify-between gap-3">
									<div>
										<p className="text-base font-semibold text-slate-900 dark:text-white">
											{claim.existingClient ?
												`${claim.existingClient.name} · ${claim.existingClient.clientCode}`
											:	"Client deleted"}
										</p>
										<p className="text-sm text-slate-500 dark:text-slate-400">
											Phone {claim.phoneKey} · claimant entered the name &ldquo;{claim.submitted?.name || "—"}&rdquo;
										</p>
									</div>
									<span
										className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${STATUS_BADGE[claim.status]}`}
									>
										{STATUS_LABEL[claim.status]}
									</span>
								</div>

								<div className="mt-4 grid gap-3 md:grid-cols-2">
									<Person
										label="Registered by"
										user={claim.existingBroker}
										time={claim.evidence?.registeredAt}
										timeLabel="Registered"
									/>
									<Person label="Claimed by" user={claim.claimant} time={claim.createdAt} timeLabel="Attempted" />
								</div>

								<p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
									<ShieldCheck size={14} />
									{claim.evidence?.firstAuditSeq ?
										<>
											Registration verified by audit entry #{claim.evidence.firstAuditSeq}
											<code className="rounded bg-slate-100 px-1 dark:bg-slate-700">
												{claim.evidence.firstAuditHash?.slice(0, 12)}…
											</code>
										</>
									:	"Registered before the audit log existed; the date comes from the client record."}
								</p>

								{claim.status === "open" ?
									<div className="mt-4 flex flex-wrap gap-3">
										<button
											type="button"
											disabled={resolvingId === claim._id}
											onClick={() => handleResolve(claim, "keep")}
											className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
										>
											<ShieldCheck size={16} /> Keep with {claim.existingBroker?.name || "current broker"}
										</button>
										<button
											type="button"
											disabled={resolvingId === claim._id || !claim.existingClient}
											onClick={() => handleResolve(claim, "transfer")}
											className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
										>
											<UserCheck size={16} /> Transfer to {claim.claimant?.name}
										</button>
									</div>
								:	<p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
										Resolved by {claim.resolvedBy?.name || "admin"} on {formatDateTime(claim.resolvedAt)}
										{claim.note ? ` · "${claim.note}"` : ""}
									</p>
								}
							</article>
						))}
					</div>
				}

				{pagination.pages > 1 ?
					<div className="flex items-center justify-end gap-3 text-sm text-slate-600 dark:text-slate-300">
						<button
							type="button"
							aria-label="Previous page"
							disabled={pagination.page <= 1}
							onClick={() => setPagination((c) => ({ ...c, page: c.page - 1 }))}
							className="rounded-xl border border-slate-200 p-2 disabled:opacity-40 dark:border-slate-700"
						>
							<ChevronLeft size={16} />
						</button>
						Page {pagination.page} of {pagination.pages}
						<button
							type="button"
							aria-label="Next page"
							disabled={pagination.page >= pagination.pages}
							onClick={() => setPagination((c) => ({ ...c, page: c.page + 1 }))}
							className="rounded-xl border border-slate-200 p-2 disabled:opacity-40 dark:border-slate-700"
						>
							<ChevronRight size={16} />
						</button>
					</div>
				:	null}
			</div>
		</section>
	);
};

export default OwnershipClaims;

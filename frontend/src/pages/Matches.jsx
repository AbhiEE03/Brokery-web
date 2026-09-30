import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { createMatch, deleteMatch, getMatches, updateMatch } from "../api/matchApi";
import useConfirmDialog from "../hooks/useConfirmDialog";
import { messageFrom } from "../utils/errors";
import { formatINR } from "../utils/format";
import AsyncCombobox from "../components/ui/AsyncCombobox";
import { getClients } from "../api/clientApi";
import { getProperties } from "../api/propertyApi";

const interestOptions = ["high", "medium", "low"];

const formatDate = (value) => {
	if (!value) return "Unknown date";
	return new Date(value).toLocaleDateString("en-IN", {
		dateStyle: "medium",
	});
};

const getInterestTone = (value) => {
	switch (value) {
		case "high":
			return "bg-rose-50 text-rose-700";
		case "medium":
			return "bg-amber-50 text-amber-700";
		case "low":
			return "bg-sky-50 text-sky-700";
		default:
			return "bg-slate-100 text-slate-700";
	}
};

const getStatusTone = () => "bg-emerald-50 text-emerald-700";

const Matches = () => {
	const [matches, setMatches] = useState([]);
	const [pagination, setPagination] = useState({
		page: 1,
		limit: 10,
		total: 0,
		pages: 1,
	});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [refreshKey, setRefreshKey] = useState(0);
	const [formOpen, setFormOpen] = useState(false);
	const [creating, setCreating] = useState(false);
	const [formData, setFormData] = useState({
		clientId: "",
		propertyId: "",
		interestLevel: "high",
	});
	const [busyId, setBusyId] = useState("");
	const { confirm, dialog } = useConfirmDialog();
	const [pickedClient, setPickedClient] = useState(null);
	const [pickedProperty, setPickedProperty] = useState(null);

	// Pickers search the API as you type: no cap on how many clients or properties exist.
	const searchClients = async (text) =>
		((await getClients({ search: text || undefined, limit: 8 })).data || []).map((c) => ({
			value: c._id,
			label: `${c.name} (${c.clientCode})`,
			hint: [c.requirements?.locality || c.requirements?.city, c.pipelineStage?.replace("_", " ")].filter(Boolean).join(" · "),
		}));
	const searchProperties = async (text) =>
		((await getProperties({ search: text || undefined, limit: 8 })).data || []).map((p) => ({
			value: p._id,
			label: `${p.title} (${p.propertyCode})`,
			hint: [formatINR(p.pricing?.askingPrice), p.location?.locality || p.location?.city, p.status?.replace("_", " ")].filter(Boolean).join(" · "),
		}));

	useEffect(() => {
		let isMounted = true;

		const loadMatches = async () => {
			setLoading(true);
			setError("");

			try {
				const response = await getMatches({
					page: pagination.page,
					limit: pagination.limit,
				});
				if (!isMounted) return;

				setMatches(response.data || []);
				setPagination((current) => ({
					...current,
					...(response.pagination || {}),
				}));
			} catch (err) {
				if (!isMounted) return;
				setError(err.response?.data?.message || "Failed to load matches.");
			} finally {
				if (isMounted) setLoading(false);
			}
		};

		loadMatches();

		return () => {
			isMounted = false;
		};
	}, [pagination.page, pagination.limit, refreshKey]);

	const handleCreateMatch = async (event) => {
		event.preventDefault();
		setCreating(true);
		setError("");

		try {
			await createMatch({
				client: formData.clientId,
				property: formData.propertyId,
				interestLevel: formData.interestLevel,
			});

			setFormData({ clientId: "", propertyId: "", interestLevel: "high" });
			setPickedClient(null);
			setPickedProperty(null);
			setFormOpen(false);

			setPagination((current) => ({ ...current, page: 1 }));
			setRefreshKey((key) => key + 1);
		} catch (err) {
			setError(err.response?.data?.message || "Unable to create match.");
		} finally {
			setCreating(false);
		}
	};

	const matchStatus = (match) => (match.createdBy ? "Linked" : "Active");

	const handleInterestChange = async (match, interestLevel) => {
		setBusyId(match._id);
		setError("");
		try {
			await updateMatch(match._id, { interestLevel });
			setMatches((current) => current.map((m) => (m._id === match._id ? { ...m, interestLevel } : m)));
		} catch (err) {
			setError(messageFrom(err, "Unable to update the match."));
		} finally {
			setBusyId("");
		}
	};

	const handleDelete = async (match) => {
		const ok = await confirm({
			title: "Remove this link?",
			message: `${match.client?.name || "The client"} will no longer be linked to ${match.property?.title || "this property"}. The removal is recorded in the history.`,
			confirmLabel: "Remove",
			tone: "danger",
		});
		if (!ok) return;
		setBusyId(match._id);
		setError("");
		try {
			await deleteMatch(match._id);
			setRefreshKey((key) => key + 1);
		} catch (err) {
			setError(messageFrom(err, "Unable to remove the match."));
		} finally {
			setBusyId("");
		}
	};

	return (
		<section className="p-6 sm:p-8">
			{dialog}
			<div className="flex flex-col gap-6">
				<header className="mb-6 flex flex-col gap-1 border-b border-slate-200 pb-5 dark:border-slate-700 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
							Matches
						</h1>
						<p className="mt-1 text-sm text-slate-500 dark:text-slate-400 dark:text-slate-400">
							Client-property links your team has created, with interest levels and broker ownership.
						</p>
					</div>

					<button
						type="button"
						onClick={() => setFormOpen((open) => !open)}
						className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
					>
						<Plus size={18} />
						New Match
					</button>
				</header>

				{formOpen ? (
					<form
						onSubmit={handleCreateMatch}
						className="grid gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm sm:grid-cols-3"
					>
						<AsyncCombobox
							label="Client"
							placeholder="Search your clients…"
							queryKey="match-client-search"
							search={searchClients}
							value={pickedClient}
							onChange={(option) => {
								setPickedClient(option);
								setFormData((current) => ({ ...current, clientId: option?.value || "" }));
							}}
							required
						/>
						<AsyncCombobox
							label="Property"
							placeholder="Search by title, locality or code…"
							queryKey="match-property-search"
							search={searchProperties}
							value={pickedProperty}
							onChange={(option) => {
								setPickedProperty(option);
								setFormData((current) => ({ ...current, propertyId: option?.value || "" }));
							}}
							required
						/>

						<label className="block">
							<span className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-400 dark:text-slate-400">Interest Level</span>
							<select
								value={formData.interestLevel}
								onChange={(event) =>
									setFormData((current) => ({
										...current,
										interestLevel: event.target.value,
									}))
								}
								className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none transition focus:border-slate-400"
							>
								{interestOptions.map((option) => (
									<option key={option} value={option}>
										{option}
									</option>
								))}
							</select>
						</label>

						<div className="sm:col-span-3 flex justify-end gap-3">
							<button
								type="button"
								onClick={() => setFormOpen(false)}
								className="rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300"
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={creating}
								className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-70"
							>
								{creating ? "Creating..." : "Create Match"}
							</button>
						</div>
					</form>
				) : null}

				{error ? (
					<div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
						{error}
					</div>
				) : null}

				<div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm">
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
							<thead className="bg-slate-50 dark:bg-slate-700/50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
								<tr>
									<th className="px-6 py-4">Client</th>
									<th className="px-6 py-4">Property</th>
									<th className="px-6 py-4">Interest Level</th>
									<th className="px-6 py-4">Status</th>
									<th className="px-6 py-4">Broker</th>
									<th className="px-6 py-4">Date</th>
									<th className="px-6 py-4"><span className="sr-only">Actions</span></th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
								{loading ? (
									<tr>
										<td className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400" colSpan={7}>
											Loading matches...
										</td>
									</tr>
								) : matches.length === 0 ? (
									<tr>
										<td className="px-6 py-8 text-sm text-slate-500 dark:text-slate-400" colSpan={7}>
											No matches found.
										</td>
									</tr>
								) : (
									matches.map((match) => (
										<tr key={match._id} className="transition hover:bg-slate-50 dark:hover:bg-slate-700/30">
											<td className="px-6 py-4">
												<div className="font-medium text-slate-950 dark:text-white">
													{match.client?.name || "Unknown client"}
												</div>
												<div className="text-sm text-slate-500 dark:text-slate-400">
													{match.client?.clientCode || match.client?._id || "No code"}
												</div>
											</td>
											<td className="px-6 py-4">
												<div className="font-medium text-slate-950 dark:text-white">
													{match.property?.title || "Unknown property"}
												</div>
												<div className="text-sm text-slate-500 dark:text-slate-400">
													{match.property?.propertyCode || match.property?._id || "No code"}
												</div>
											</td>
											<td className="px-6 py-4 text-sm">
												<select
													aria-label={`Interest level for ${match.client?.name || "client"}`}
													value={match.interestLevel}
													disabled={busyId === match._id}
													onChange={(event) => handleInterestChange(match, event.target.value)}
													className={`rounded-full border-0 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getInterestTone(match.interestLevel)}`}
												>
													{interestOptions.map((option) => (
														<option key={option} value={option}>
															{option}
														</option>
													))}
												</select>
											</td>
											<td className="px-6 py-4 text-sm">
												<span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getStatusTone(match)}`}>
													{match.status || matchStatus(match)}
												</span>
											</td>
											<td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 dark:text-slate-400">
												{match.createdBy?.name || "Unassigned"}
											</td>
											<td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400 dark:text-slate-400">
												{formatDate(match.createdAt)}
											</td>
											<td className="px-6 py-4 text-right">
												<button
													type="button"
													aria-label={`Remove link between ${match.client?.name || "client"} and ${match.property?.title || "property"}`}
													disabled={busyId === match._id}
													onClick={() => handleDelete(match)}
													className="rounded-xl p-2 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-900/30"
												>
													<Trash2 size={16} />
												</button>
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>

					<div className="flex items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 px-6 py-4">
						<p className="text-sm text-slate-600 dark:text-slate-400 dark:text-slate-400">
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
								className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
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
								className="inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
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

export default Matches;
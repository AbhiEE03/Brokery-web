import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { createMatch, getMatches } from "../api/matchApi";

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
	const user = useSelector((state) => state.auth.user);
	const isAdmin = user?.role === "admin";
	const [matches, setMatches] = useState([]);
	const [pagination, setPagination] = useState({
		page: 1,
		limit: 10,
		total: 0,
		pages: 1,
	});
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [formOpen, setFormOpen] = useState(false);
	const [creating, setCreating] = useState(false);
	const [formData, setFormData] = useState({
		clientId: "",
		propertyId: "",
		interestLevel: "high",
	});

	const visibleMatches = useMemo(() => {
		const start = (pagination.page - 1) * pagination.limit;
		return matches.slice(start, start + pagination.limit);
	}, [matches, pagination.page, pagination.limit]);

	useEffect(() => {
		let isMounted = true;

		const loadMatches = async () => {
			setLoading(true);
			setError("");

			try {
				const response = await getMatches();
				if (!isMounted) return;

				const data = response.data || [];
				setMatches(data);
				setPagination((current) => ({
					...current,
					total: data.length,
					pages: Math.max(1, Math.ceil(data.length / current.limit)),
					page: 1,
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
	}, []);

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
			setFormOpen(false);

			const response = await getMatches();
			const data = response.data || [];
			setMatches(data);
			setPagination((current) => ({
				...current,
				total: data.length,
				pages: Math.max(1, Math.ceil(data.length / current.limit)),
				page: 1,
			}));
		} catch (err) {
			setError(err.response?.data?.message || "Unable to create match.");
		} finally {
			setCreating(false);
		}
	};

	const matchStatus = (match) => (match.createdBy ? "Linked" : "Active");

	return (
		<section className="p-6 sm:p-8">
			<div className="flex flex-col gap-6">
				<header className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm sm:p-8 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
							Match records
						</p>
						<h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
							Matches
						</h1>
						<p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
							Review client-to-property links, broker ownership, and interest levels in one place.
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
						className="grid gap-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-3"
					>
						{[
							["clientId", "Client ID"],
							["propertyId", "Property ID"],
						].map(([field, label]) => (
							<label key={field} className="block">
								<span className="mb-2 block text-sm font-medium text-slate-600">
									{label}
								</span>
								<input
									type="text"
									value={formData[field]}
									onChange={(event) =>
										setFormData((current) => ({
											...current,
											[field]: event.target.value,
										}))
									}
									className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
									required
								/>
							</label>
						))}

						<label className="block">
							<span className="mb-2 block text-sm font-medium text-slate-600">Interest Level</span>
							<select
								value={formData.interestLevel}
								onChange={(event) =>
									setFormData((current) => ({
										...current,
										interestLevel: event.target.value,
									}))
								}
								className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400"
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
								className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
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

				<div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
					<div className="overflow-x-auto">
						<table className="min-w-full divide-y divide-slate-200">
							<thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
								<tr>
									<th className="px-6 py-4">Client</th>
									<th className="px-6 py-4">Property</th>
									<th className="px-6 py-4">Interest Level</th>
									<th className="px-6 py-4">Status</th>
									<th className="px-6 py-4">Broker</th>
									<th className="px-6 py-4">Date</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100 bg-white">
								{loading ? (
									<tr>
										<td className="px-6 py-8 text-sm text-slate-500" colSpan={6}>
											Loading matches...
										</td>
									</tr>
								) : visibleMatches.length === 0 ? (
									<tr>
										<td className="px-6 py-8 text-sm text-slate-500" colSpan={6}>
											No matches found.
										</td>
									</tr>
								) : (
									visibleMatches.map((match) => (
										<tr key={match._id} className="transition hover:bg-slate-50">
											<td className="px-6 py-4">
												<div className="font-medium text-slate-950">
													{match.client?.name || "Unknown client"}
												</div>
												<div className="text-sm text-slate-500">
													{match.client?.clientCode || match.client?._id || "No code"}
												</div>
											</td>
											<td className="px-6 py-4">
												<div className="font-medium text-slate-950">
													{match.property?.title || "Unknown property"}
												</div>
												<div className="text-sm text-slate-500">
													{match.property?.propertyCode || match.property?._id || "No code"}
												</div>
											</td>
											<td className="px-6 py-4 text-sm">
												<span
													className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getInterestTone(match.interestLevel)}`}
												>
													{match.interestLevel || "unknown"}
												</span>
											</td>
											<td className="px-6 py-4 text-sm">
												<span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${getStatusTone(match)}`}>
													{match.status || matchStatus(match)}
												</span>
											</td>
											<td className="px-6 py-4 text-sm text-slate-600">
												{match.createdBy?.name || "Unassigned"}
											</td>
											<td className="px-6 py-4 text-sm text-slate-600">
												{formatDate(match.createdAt)}
											</td>
										</tr>
									))
								)}
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

export default Matches;
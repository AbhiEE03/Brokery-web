import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";
import { createClient, getClients } from "../api/clientApi";

const stageOptions = [
	"all",
	"lead",
	"contacted",
	"site_visit",
	"negotiation",
	"closed",
	"lost",
];

const Clients = () => {
	const navigate = useNavigate();
	const [clients, setClients] = useState([]);
	const [pagination, setPagination] = useState({
		page: 1,
		limit: 10,
		total: 0,
		pages: 1,
	});
	const [searchTerm, setSearchTerm] = useState("");
	const [stage, setStage] = useState("all");
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [formOpen, setFormOpen] = useState(false);
	const [formData, setFormData] = useState({
		name: "",
		phone: "",
		email: "",
		notes: "",
	});
	const [creating, setCreating] = useState(false);

	const queryParams = useMemo(
		() => ({
			page: pagination.page,
			limit: pagination.limit,
			search: searchTerm || undefined,
			stage: stage === "all" ? undefined : stage,
		}),
		[pagination.page, pagination.limit, searchTerm, stage],
	);

	useEffect(() => {
		let isMounted = true;

		const loadClients = async () => {
			setLoading(true);
			setError("");

			try {
				const response = await getClients(queryParams);
				if (!isMounted) return;
				setClients(response.data || []);
				setPagination((current) => ({
					...current,
					...(response.pagination || {}),
				}));
			} catch (err) {
				if (!isMounted) return;
				setError(err.response?.data?.message || "Failed to load clients.");
			} finally {
				if (isMounted) setLoading(false);
			}
		};

		loadClients();

		return () => {
			isMounted = false;
		};
	}, [queryParams]);

	useEffect(() => {
		setPagination((current) => ({ ...current, page: 1 }));
	}, [searchTerm, stage]);

	const handleCreateClient = async (event) => {
		event.preventDefault();
		setCreating(true);
		setError("");

		try {
			await createClient(formData);
			setFormData({ name: "", phone: "", email: "", notes: "" });
			setFormOpen(false);
			const response = await getClients({
				page: 1,
				limit: pagination.limit,
				search: searchTerm || undefined,
				stage: stage === "all" ? undefined : stage,
			});
			setClients(response.data || []);
			setPagination((current) => ({
				...current,
				...(response.pagination || {}),
				page: 1,
			}));
		} catch (err) {
			setError(err.response?.data?.message || "Unable to create client.");
		} finally {
			setCreating(false);
		}
	};

	return (
		<section className="p-6 sm:p-8">
			<div className="flex flex-col gap-6">
				<header className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm sm:p-8 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
							Client records
						</p>
						<h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
							Clients
						</h1>
						<p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
							Search, filter, and open any client to review pipeline stage,
							requirements, and edit history.
						</p>
					</div>

					<button
						type="button"
						onClick={() => setFormOpen((open) => !open)}
						className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
					>
						<Plus size={18} />
						New Client
					</button>
				</header>

				<div className="grid gap-4 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-[1fr_220px] lg:items-center lg:p-5">
					<label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-slate-400">
						<Search size={18} className="text-slate-400" />
						<input
							type="search"
							value={searchTerm}
							onChange={(event) => setSearchTerm(event.target.value)}
							placeholder="Search client name"
							className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
						/>
					</label>

					<select
						value={stage}
						onChange={(event) => setStage(event.target.value)}
						className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400"
					>
						{stageOptions.map((option) => (
							<option key={option} value={option}>
								{option === "all" ? "All stages" : option.replace("_", " ")}
							</option>
						))}
					</select>
				</div>

				{formOpen ?
					<form
						onSubmit={handleCreateClient}
						className="grid gap-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2"
					>
						{[
							["name", "Name"],
							["phone", "Phone"],
							["email", "Email"],
							["notes", "Notes"],
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
									required={field !== "notes"}
								/>
							</label>
						))}
						<div className="sm:col-span-2 flex justify-end gap-3">
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
								{creating ? "Creating..." : "Create Client"}
							</button>
						</div>
					</form>
				:	null}

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
									<th className="px-6 py-4">Client</th>
									<th className="px-6 py-4">Code</th>
									<th className="px-6 py-4">Phone</th>
									<th className="px-6 py-4">Stage</th>
									<th className="px-6 py-4">Broker</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-slate-100 bg-white">
								{loading ?
									<tr>
										<td
											className="px-6 py-8 text-sm text-slate-500"
											colSpan={5}
										>
											Loading clients...
										</td>
									</tr>
								: clients.length === 0 ?
									<tr>
										<td
											className="px-6 py-8 text-sm text-slate-500"
											colSpan={5}
										>
											No clients found.
										</td>
									</tr>
								:	clients.map((client) => (
										<tr
											key={client._id}
											onClick={() => navigate(`/clients/${client._id}`)}
											className="cursor-pointer transition hover:bg-slate-50"
										>
											<td className="px-6 py-4">
												<div className="font-medium text-slate-950">
													{client.name}
												</div>
												<div className="text-sm text-slate-500">
													{client.email || "No email"}
												</div>
											</td>
											<td className="px-6 py-4 text-sm text-slate-600">
												{client.clientCode}
											</td>
											<td className="px-6 py-4 text-sm text-slate-600">
												{client.phone}
											</td>
											<td className="px-6 py-4 text-sm">
												<span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
													{client.pipelineStage?.replace("_", " ")}
												</span>
											</td>
											<td className="px-6 py-4 text-sm text-slate-600">
												{client.assignedBroker?.name || "Unassigned"}
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

export default Clients;

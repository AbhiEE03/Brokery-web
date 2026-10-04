import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { Kanban, List, Plus, Search } from "lucide-react";
import {
	useClientMutations,
	useClients,
	usePendingStageChanges,
} from "../hooks/queries";
import useDebouncedValue from "../hooks/useDebouncedValue";
import useToast from "../hooks/useToast";
import Pagination from "../components/ui/Pagination";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import PipelineBoard from "../components/clients/PipelineBoard";
import NewClientForm from "../components/clients/NewClientForm";
import { STAGE_BY_KEY, STAGES, stageLabel } from "../utils/stages";
import { formatINR } from "../utils/format";
import { messageFrom } from "../utils/errors";

const VIEW_KEY = "clients-view";
const readView = () => {
	try {
		return localStorage.getItem(VIEW_KEY) === "board" ? "board" : "list";
	} catch {
		return "list";
	}
};

const Clients = () => {
	const navigate = useNavigate();
	const toast = useToast();
	const isAdmin = useSelector((state) => state.auth.user?.role === "admin");
	const [params, setParams] = useSearchParams();
	const [view, setView] = useState(() => params.get("view") || readView());
	// ?view=board (e.g. from the command palette) switches the view even when already here.
	useEffect(() => {
		const requested = params.get("view");
		if (requested === "board" || requested === "list") setView(requested);
	}, [params]);
	const [searchTerm, setSearchTerm] = useState("");
	const [stage, setStage] = useState("");
	const [page, setPage] = useState(1);
	const [formOpen, setFormOpen] = useState(false);
	const search = useDebouncedValue(searchTerm.trim());

	// The board shows every stage at once (up to 100 clients); the list pages 10 at a time.
	const query = useClients(
		view === "board" ?
			{ search, limit: 100 }
		:	{ search, stage: stage || undefined, page, limit: 10 },
	);
	const pending = usePendingStageChanges();
	const { create, moveStage } = useClientMutations();
	const clients = query.data?.data || [];
	const pagination = query.data?.pagination || { page: 1, pages: 1 };

	const switchView = (next) => {
		setView(next);
		setParams({}, { replace: true });
		try {
			localStorage.setItem(VIEW_KEY, next);
		} catch {
			// Remembering the view is a convenience only.
		}
	};

	const handleCreate = (payload, reset) =>
		create.mutate(payload, {
			onSuccess: (response) => {
				reset();
				setFormOpen(false);
				toast.success("Client added", {
					description: `${response.data.name} · ${response.data.clientCode}`,
				});
			},
			onError: (error) =>
				toast.error("Couldn't add the client", {
					description: messageFrom(error),
				}),
		});

	const handleMove = (client, target) =>
		moveStage.mutate(
			{ id: client._id, stage: target },
			{
				onSuccess: (response) =>
					response.status === 202 ?
						toast.info("Sent for approval", {
							description: `${client.name} → ${stageLabel(target)} once an admin approves.`,
						})
					:	toast.success(`Moved to ${stageLabel(target)}`, {
							description: client.name,
						}),
				onError: (error) =>
					toast.error("Couldn't move the client", {
						description: messageFrom(error),
					}),
			},
		);

	const tabButton = (key, label, Icon) => (
		<button
			type="button"
			role="tab"
			aria-selected={view === key}
			onClick={() => switchView(key)}
			className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
				view === key ?
					"bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
				:	"text-slate-500 hover:text-slate-800 dark:text-slate-400"
			}`}
		>
			<Icon size={15} /> {label}
		</button>
	);

	return (
		<section className="p-6 sm:p-8">
			<div className="flex flex-col gap-6">
				<header className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-700 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
							Clients
						</h1>
						<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
							{view === "board" ?
								"Drag a client to another stage. For brokers, stage changes go to an admin for approval."
							:	"Everyone you're working with. Open a client for matches, shortlists and history."
							}
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-3">
						<div
							role="tablist"
							aria-label="View"
							className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
						>
							{tabButton("list", "List", List)}
							{tabButton("board", "Board", Kanban)}
						</div>
						<button
							type="button"
							onClick={() => setFormOpen((open) => !open)}
							className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
						>
							<Plus size={18} /> New client
						</button>
					</div>
				</header>

				{formOpen ?
					<NewClientForm
						onSubmit={handleCreate}
						onCancel={() => setFormOpen(false)}
						submitting={create.isPending}
					/>
				:	null}

				<div className="flex flex-col gap-3 sm:flex-row">
					<label className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 focus-within:border-slate-400 dark:border-slate-700 dark:bg-slate-800">
						<Search size={18} className="text-slate-400" />
						<input
							type="search"
							value={searchTerm}
							onChange={(event) => {
								setSearchTerm(event.target.value);
								setPage(1);
							}}
							placeholder="Search by name"
							aria-label="Search clients"
							className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400 dark:text-white"
						/>
					</label>
					{view === "list" ?
						<select
							value={stage}
							onChange={(event) => {
								setStage(event.target.value);
								setPage(1);
							}}
							aria-label="Stage"
							className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
						>
							<option value="">All stages</option>
							{STAGES.map((s) => (
								<option key={s.key} value={s.key}>
									{s.label}
								</option>
							))}
						</select>
					:	null}
				</div>

				{query.isError ?
					<ErrorState error={query.error} onRetry={query.refetch} />
				:	null}

				{query.isPending ?
					<LoadingState label="Loading clients..." />
				: view === "board" ?
					<PipelineBoard
						clients={clients}
						pendingByClient={pending.data || new Map()}
						isAdmin={isAdmin}
						onMove={handleMove}
						busyId={moveStage.isPending ? moveStage.variables?.id : null}
					/>
				: clients.length === 0 ?
					<EmptyState
						title="No clients found"
						hint={
							search || stage ?
								"Try a different search or stage."
							:	"Add your first client with “New client”."
						}
					/>
				:	<div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
						<div className="overflow-x-auto">
							<table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
								<thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">
									<tr>
										<th className="px-6 py-3">Client</th>
										<th className="px-6 py-3">Looking for</th>
										<th className="px-6 py-3">Stage</th>
										{isAdmin ?
											<th className="px-6 py-3">Broker</th>
										:	null}
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100 dark:divide-slate-700">
									{clients.map((client) => {
										const r = client.requirements || {};
										const pendingStage = pending.data?.get(client._id);
										return (
											<tr
												key={client._id}
												tabIndex={0}
												onClick={() => navigate(`/clients/${client._id}`)}
												onKeyDown={(event) =>
													event.key === "Enter" &&
													navigate(`/clients/${client._id}`)
												}
												className="cursor-pointer transition hover:bg-slate-50 focus:bg-slate-50 focus:outline-none dark:hover:bg-slate-700/30 dark:focus:bg-slate-700/30"
											>
												<td className="px-6 py-4">
													<div className="font-medium text-slate-950 dark:text-white">
														{client.name}
													</div>
													<div className="text-xs text-slate-500 dark:text-slate-400">
														{client.clientCode} · {client.phone}
													</div>
												</td>
												<td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-300">
													{[
														r.bedrooms ? `${r.bedrooms} BHK` : null,
														r.propertyType,
														r.locality || r.city,
													]
														.filter(Boolean)
														.join(" · ") || "—"}
													{r.maxBudget ?
														<div className="text-xs text-slate-500 dark:text-slate-400">
															{r.minBudget ?
																`${formatINR(r.minBudget)}–`
															:	"up to "}
															{formatINR(r.maxBudget)}
														</div>
													:	null}
												</td>
												<td className="px-6 py-4 text-sm">
													<span
														className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STAGE_BY_KEY[client.pipelineStage]?.badge || ""}`}
													>
														{stageLabel(client.pipelineStage)}
													</span>
													{pendingStage ?
														<div className="mt-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
															→ {stageLabel(pendingStage)} pending
														</div>
													:	null}
												</td>
												{isAdmin ?
													<td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
														{client.assignedBroker?.name || "Unassigned"}
													</td>
												:	null}
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
						<Pagination
							page={pagination.page}
							pages={pagination.pages}
							total={pagination.total}
							onPageChange={setPage}
						/>
					</div>
				}
			</div>
		</section>
	);
};

export default Clients;

import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock3, GripVertical } from "lucide-react";
import { STAGES, stageLabel } from "../../utils/stages";
import { formatINR } from "../../utils/format";

/**
 * Pipedrive-style board: one column per stage. Drag a card to another column
 * (or use its "Move to" menu, for keyboard users) to change the stage. For
 * brokers that becomes a change request; the card shows it as pending.
 */
const ClientCard = ({ client, pendingStage, isAdmin, onMove, busy }) => (
	<article
		draggable={!busy}
		onDragStart={(event) => {
			event.dataTransfer.setData("text/plain", client._id);
			event.dataTransfer.effectAllowed = "move";
		}}
		className="group rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
	>
		<div className="flex items-start gap-2">
			<GripVertical size={14} className="mt-1 shrink-0 cursor-grab text-slate-300 group-hover:text-slate-400" aria-hidden="true" />
			<div className="min-w-0 flex-1">
				<Link to={`/clients/${client._id}`} className="block truncate text-sm font-semibold text-slate-900 hover:underline dark:text-white">
					{client.name}
				</Link>
				<p className="text-xs text-slate-500 dark:text-slate-400">
					{client.clientCode}
					{client.requirements?.city ? ` · ${client.requirements.locality || client.requirements.city}` : ""}
				</p>
				{client.requirements?.maxBudget ?
					<p className="mt-1 text-xs font-medium text-slate-700 dark:text-slate-200">
						{client.requirements.minBudget ? `${formatINR(client.requirements.minBudget)}–` : "up to "}
						{formatINR(client.requirements.maxBudget)}
					</p>
				:	null}
				{isAdmin && client.assignedBroker ?
					<p className="mt-1 text-[11px] text-slate-400">{client.assignedBroker.name}</p>
				:	null}
				{pendingStage ?
					<p className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
						<Clock3 size={11} /> Awaiting approval → {stageLabel(pendingStage)}
					</p>
				:	null}
			</div>
		</div>
		<label className="mt-2 block">
			<span className="sr-only">Move {client.name} to stage</span>
			<select
				value=""
				disabled={busy}
				onChange={(event) => event.target.value && onMove(client, event.target.value)}
				className="w-full rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-[11px] text-slate-400 hover:border-slate-200 focus:border-slate-300 dark:hover:border-slate-600"
			>
				<option value="">Move to…</option>
				{STAGES.filter((s) => s.key !== client.pipelineStage).map((s) => (
					<option key={s.key} value={s.key}>
						{s.label}
					</option>
				))}
			</select>
		</label>
	</article>
);

const PipelineBoard = ({ clients, pendingByClient, isAdmin, onMove, busyId }) => {
	const [over, setOver] = useState(null);
	const byStage = Object.fromEntries(STAGES.map((s) => [s.key, []]));
	clients.forEach((client) => byStage[client.pipelineStage]?.push(client));

	return (
		<div className="-mx-2 overflow-x-auto pb-2">
			<div className="flex min-w-max gap-4 px-2">
				{STAGES.map((stage) => {
					const items = byStage[stage.key];
					const total = items.reduce((sum, c) => sum + (c.requirements?.maxBudget || 0), 0);
					return (
						<section
							key={stage.key}
							aria-label={`${stage.label} column`}
							onDragOver={(event) => {
								event.preventDefault();
								setOver(stage.key);
							}}
							onDragLeave={() => setOver((current) => (current === stage.key ? null : current))}
							onDrop={(event) => {
								event.preventDefault();
								setOver(null);
								const id = event.dataTransfer.getData("text/plain");
								const client = clients.find((c) => c._id === id);
								if (client && client.pipelineStage !== stage.key) onMove(client, stage.key);
							}}
							className={`flex w-72 shrink-0 flex-col rounded-2xl border p-3 transition ${
								over === stage.key ?
									"border-emerald-400 bg-emerald-50/60 dark:border-emerald-600 dark:bg-emerald-900/20"
								:	"border-slate-200 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/40"
							}`}
						>
							<header className="mb-3 flex items-center justify-between px-1">
								<span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
									<span className={`h-2 w-2 rounded-full ${stage.dot}`} />
									{stage.label}
									<span className="rounded-full bg-white px-2 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
										{items.length}
									</span>
								</span>
								{total ? <span className="text-[11px] font-medium text-slate-400">{formatINR(total)}</span> : null}
							</header>
							<div className="flex min-h-24 flex-1 flex-col gap-2">
								{items.length ?
									items.map((client) => (
										<ClientCard
											key={client._id}
											client={client}
											pendingStage={pendingByClient.get(client._id)}
											isAdmin={isAdmin}
											onMove={onMove}
											busy={busyId === client._id}
										/>
									))
								:	<p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400 dark:border-slate-700">
										Drop a client here
									</p>
								}
							</div>
						</section>
					);
				})}
			</div>
		</div>
	);
};

export default PipelineBoard;

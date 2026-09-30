import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import { useInterestedClients } from "../../hooks/queries";
import { formatINR } from "../../utils/format";
import { EmptyState, ErrorState, LoadingState } from "../ui/States";
import { MatchBadge } from "./MatchReasons";

/** Active clients this property suits, best first (brokers see their own clients). */
const InterestedClients = ({ propertyId }) => {
	const query = useInterestedClients(propertyId);
	const items = query.data?.data || [];

	return (
		<section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8 xl:col-span-2">
			<p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
				<Users size={16} /> Who might want this
			</p>
			<h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Interested clients</h2>

			<div className="mt-6">
				{query.isPending ?
					<LoadingState label="Looking for clients..." />
				: query.isError ?
					<ErrorState error={query.error} onRetry={query.refetch} />
				: items.length === 0 ?
					<EmptyState title="No active clients fit this listing yet." hint="Clients already linked to it are not shown." />
				:	<ul className="divide-y divide-slate-100 dark:divide-slate-700">
						{items.map(({ client, score, breakdown }) => (
							<li key={client._id} className="flex flex-wrap items-center gap-4 py-3">
								<MatchBadge score={score} />
								<div className="min-w-0 flex-1">
									<Link to={`/clients/${client._id}`} className="font-semibold text-slate-900 hover:underline dark:text-white">
										{client.name}
									</Link>
									<span className="ml-2 text-xs text-slate-500 dark:text-slate-400">
										{client.clientCode} · {client.pipelineStage.replace("_", " ")}
									</span>
									<p className="truncate text-xs text-slate-500 dark:text-slate-400">
										Budget {formatINR(client.requirements?.minBudget)}–{formatINR(client.requirements?.maxBudget)} ·{" "}
										{breakdown[0]?.reason}
									</p>
								</div>
							</li>
						))}
					</ul>
				}
			</div>
		</section>
	);
};

export default InterestedClients;

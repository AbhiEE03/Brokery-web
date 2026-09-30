import { useState } from "react";
import { Link } from "react-router-dom";
import { Building2, ChevronDown, ChevronUp, Link2, Sparkles, ThumbsDown } from "lucide-react";
import { useRecommendationAction, useRecommendations } from "../../hooks/queries";
import useToast from "../../hooks/useToast";
import { messageFrom } from "../../utils/errors";
import { formatINR } from "../../utils/format";
import { EmptyState, ErrorState, LoadingState } from "../ui/States";
import MatchReasons, { MatchBadge } from "./MatchReasons";

const PropertyThumb = ({ property }) =>
	property.image ?
		<img src={property.image} alt="" className="h-32 w-full object-cover" loading="lazy" />
	:	<div className="flex h-32 w-full items-center justify-center bg-gradient-to-br from-emerald-50 to-slate-100 dark:from-slate-700 dark:to-slate-800">
			<Building2 size={32} className="text-emerald-600/60 dark:text-emerald-400/60" />
		</div>;

const RecommendationCard = ({ item, onLink, onDismiss, busy }) => {
	const [open, setOpen] = useState(false);
	const { property, score, breakdown, rank } = item;
	const perSqft =
		property.pricing?.askingPrice && property.specs?.area ?
			`₹${Math.round(property.pricing.askingPrice / property.specs.area).toLocaleString("en-IN")}/sq ft`
		:	null;

	return (
		<article className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
			<div className="relative">
				<PropertyThumb property={property} />
				<div className="absolute left-3 top-3">
					<MatchBadge score={score} />
				</div>
				<span className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
					#{rank}
				</span>
			</div>

			<div className="flex flex-1 flex-col gap-3 p-4">
				<div>
					<p className="text-lg font-bold tracking-tight text-slate-950 dark:text-white">
						{formatINR(property.pricing?.askingPrice)}
						{perSqft ? <span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">{perSqft}</span> : null}
					</p>
					<Link to={`/properties/${property._id}`} className="line-clamp-1 text-sm font-semibold text-slate-800 hover:underline dark:text-slate-100">
						{property.title}
					</Link>
					<p className="text-xs text-slate-500 dark:text-slate-400">
						{[property.location?.locality, property.location?.city].filter(Boolean).join(", ")} · {property.propertyCode}
					</p>
					<p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
						{[
							property.specs?.bedrooms ? `${property.specs.bedrooms} BHK` : null,
							property.specs?.area ? `${property.specs.area.toLocaleString("en-IN")} sq ft` : null,
							property.propertyType,
						]
							.filter(Boolean)
							.join(" · ")}
					</p>
				</div>

				<MatchReasons breakdown={breakdown} detailed={open} />
				<button
					type="button"
					onClick={() => setOpen((v) => !v)}
					aria-expanded={open}
					className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
				>
					{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
					{open ? "Less detail" : "Score breakdown"}
				</button>

				<div className="mt-auto flex gap-2 pt-1">
					<button
						type="button"
						disabled={busy}
						onClick={() => onLink(item)}
						className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
					>
						<Link2 size={15} /> Create match
					</button>
					<button
						type="button"
						disabled={busy}
						onClick={() => onDismiss(item)}
						title="Not a fit: hide this property for this client"
						className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
					>
						<ThumbsDown size={15} />
						<span className="sr-only sm:not-sr-only">Not a fit</span>
					</button>
				</div>
			</div>
		</article>
	);
};

const Recommendations = ({ client }) => {
	const query = useRecommendations(client._id);
	const action = useRecommendationAction(client._id);
	const toast = useToast();
	const items = query.data?.data || [];
	const meta = query.data?.meta || {};

	const run = (item, kind) =>
		action.mutate(
			{ propertyId: item.property._id, action: kind, rank: item.rank },
			{
				onSuccess: () =>
					kind === "link" ?
						toast.success("Match created", { description: `${client.name} ↔ ${item.property.title}` })
					:	toast.info("Hidden for this client", { description: item.property.title }),
				onError: (error) => toast.error("Couldn't update", { description: messageFrom(error) }),
			},
		);

	return (
		<section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8 xl:col-span-2">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
						<Sparkles size={16} /> Recommended
					</p>
					<h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
						Properties that fit {client.name.split(" ")[0]}
					</h2>
					<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
						Ranked on budget, locality, size, bedrooms and how recently it was listed.
						{meta.candidates ? ` ${meta.candidates} available listing${meta.candidates === 1 ? "" : "s"} considered.` : ""}
					</p>
				</div>
			</div>

			<div className="mt-6">
				{query.isPending ?
					<LoadingState label="Finding matches..." />
				: query.isError ?
					<ErrorState error={query.error} onRetry={query.refetch} />
				: items.length === 0 ?
					<EmptyState
						title={meta.hint ? "No recommendations yet" : "Nothing new fits right now"}
						hint={meta.hint || "Every available listing in this city is already linked, dismissed or outside the budget."}
					/>
				:	<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
						{items.map((item) => (
							<RecommendationCard
								key={item.property._id}
								item={item}
								busy={action.isPending}
								onLink={(i) => run(i, "link")}
								onDismiss={(i) => run(i, "dismiss")}
							/>
						))}
					</div>
				}
			</div>
		</section>
	);
};

export default Recommendations;

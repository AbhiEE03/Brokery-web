import { Check, Minus, X } from "lucide-react";
import { scoreTone } from "./scoreTone";

const FEATURE_LABEL = { budget: "Budget", locality: "Locality", area: "Size", bedrooms: "Bedrooms", freshness: "Freshness" };

const ReasonIcon = ({ value }) =>
	value >= 0.75 ? <Check size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="good fit" />
	: value >= 0.25 ? <Minus size={14} className="shrink-0 text-amber-600 dark:text-amber-400" aria-label="partial fit" />
	: <X size={14} className="shrink-0 text-rose-600 dark:text-rose-400" aria-label="poor fit" />;

export const MatchBadge = ({ score }) => (
	<span className={`rounded-full px-2.5 py-1 text-xs font-bold tabular-nums shadow-sm ${scoreTone(score)}`}>
		{Math.round(score * 100)}% match
	</span>
);

/**
 * Why a recommendation scored what it did: the top reasons, or every feature
 * with its contribution bar when `detailed`.
 */
const MatchReasons = ({ breakdown, detailed = false, limit = 3 }) => {
	const rows = detailed ? breakdown : breakdown.slice(0, limit);
	return (
		<ul className="space-y-1.5">
			{rows.map((f) => (
				<li key={f.feature} className="text-xs text-slate-600 dark:text-slate-300">
					<div className="flex items-start gap-1.5">
						<ReasonIcon value={f.value} />
						<span className="leading-snug">{f.reason}</span>
					</div>
					{detailed ?
						<div className="ml-5 mt-1 flex items-center gap-2">
							<span className="w-16 text-[11px] uppercase tracking-wider text-slate-400">{FEATURE_LABEL[f.feature]}</span>
							<div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
								<div className="h-full rounded-full bg-slate-900 dark:bg-slate-200" style={{ width: `${(f.value * 100).toFixed(0)}%` }} />
							</div>
							<span className="w-10 text-right text-[11px] tabular-nums text-slate-400">+{f.contribution.toFixed(2)}</span>
						</div>
					:	null}
				</li>
			))}
		</ul>
	);
};

export default MatchReasons;

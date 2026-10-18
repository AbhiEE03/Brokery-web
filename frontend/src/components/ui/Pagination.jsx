import { ChevronLeft, ChevronRight } from "lucide-react";

const buttonClass =
	"inline-flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200";

/**
 * Prev / Next with an honest summary: which rows these are and how many exist.
 * Always rendered for a non-empty list, so a single page still shows its total.
 */
const Pagination = ({ page, pages, total, limit, onPageChange }) => {
	const lastPage = pages || 1;
	const first = total ? (page - 1) * limit + 1 : 0;
	const last = Math.min(total ?? 0, page * limit);
	return (
		<div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-700 dark:bg-slate-700/50">
			<p className="text-sm text-slate-600 dark:text-slate-400">
				{total !== undefined && limit ? `Showing ${first}–${last} of ${total}` : `Page ${page} of ${lastPage}`}
				{lastPage > 1 ? ` · page ${page} of ${lastPage}` : ""}
			</p>
			<div className="flex items-center gap-2">
				<button type="button" className={buttonClass} onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
					<ChevronLeft size={16} />
					Prev
				</button>
				<button type="button" className={buttonClass} onClick={() => onPageChange(page + 1)} disabled={page >= lastPage}>
					Next
					<ChevronRight size={16} />
				</button>
			</div>
		</div>
	);
};

export default Pagination;

import { useCallback, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * A list's page and filters, kept in the address bar so Back, refresh and a
 * copied link all bring the same view back (instead of resetting to page 1).
 *
 *   const list = useListState({ status: "pending" });
 *   list.page            // 1-based, from ?page=
 *   list.get("status")   // ?status= or the default
 *   list.set({ status: "conflict" })       // changing a filter goes back to page 1
 *   list.set({ page: 3 })                  // changing only the page keeps the filters
 *
 * Values equal to their default (or empty) are left out of the URL.
 */
const useListState = (defaults = {}) => {
	const [params, setParams] = useSearchParams();
	const page = Math.max(1, parseInt(params.get("page"), 10) || 1);

	const get = (key) => params.get(key) ?? defaults[key] ?? "";

	const set = useCallback(
		(patch, { replace = false } = {}) =>
			setParams(
				(previous) => {
					const next = new URLSearchParams(previous);
					for (const [key, value] of Object.entries(patch)) {
						const empty = value === undefined || value === null || value === "" || value === defaults[key];
						if (empty || (key === "page" && Number(value) <= 1)) next.delete(key);
						else next.set(key, String(value));
					}
					// Any filter change starts again from the first page.
					if (!("page" in patch)) next.delete("page");
					return next;
				},
				{ replace },
			),
		// `defaults` is a fresh object every render; its values are what matter.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[setParams, JSON.stringify(defaults)],
	);

	return { page, get, set };
};

/**
 * If the page asked for is past the end (rows moved or were deleted since it was
 * loaded, or a stale link), go to the last real page instead of showing an empty
 * list. Returns true while that redirect is pending, so the page can show
 * "loading" rather than a misleading "nothing here".
 */
export const useClampedPage = (query, page, list) => {
	const pages = query.data?.pagination?.pages;
	const clamping = !query.isPlaceholderData && pages != null && page > pages;
	useEffect(() => {
		if (clamping) list.set({ page: pages }, { replace: true });
	}, [clamping, pages, list]);
	return clamping;
};

export default useListState;

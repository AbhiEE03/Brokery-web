import { useEffect, useId, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, X } from "lucide-react";
import useDebouncedValue from "../../hooks/useDebouncedValue";

/**
 * Search-as-you-type picker backed by the API, so there's no cap on how many
 * clients or properties can be chosen from (unlike a pre-loaded <select>).
 *
 * @param search  async (text) => [{ value, label, hint }]
 */
const AsyncCombobox = ({ label, placeholder, queryKey, search, value, onChange, required }) => {
	const [text, setText] = useState("");
	const [open, setOpen] = useState(false);
	const [active, setActive] = useState(0);
	const ref = useRef(null);
	const id = useId();
	const q = useDebouncedValue(text.trim(), 200);

	const results = useQuery({
		queryKey: [queryKey, q],
		queryFn: () => search(q),
		enabled: open,
	});
	const options = results.data || [];

	useEffect(() => {
		const onClick = (event) => {
			if (!ref.current?.contains(event.target)) setOpen(false);
		};
		document.addEventListener("mousedown", onClick);
		return () => document.removeEventListener("mousedown", onClick);
	}, []);

	const pick = (option) => {
		onChange(option);
		setText("");
		setOpen(false);
	};

	const onKeyDown = (event) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setOpen(true);
			setActive((i) => Math.min(options.length - 1, i + 1));
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setActive((i) => Math.max(0, i - 1));
		} else if (event.key === "Enter" && open && options[active]) {
			event.preventDefault();
			pick(options[active]);
		} else if (event.key === "Escape") {
			setOpen(false);
		}
	};

	return (
		<div ref={ref} className="relative">
			<label htmlFor={`${id}-input`} className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-400">
				{label}
			</label>
			{value ?
				<div className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-300 bg-emerald-50/60 px-4 py-3 text-sm dark:border-emerald-800 dark:bg-emerald-900/20">
					<span className="min-w-0 truncate font-medium text-slate-900 dark:text-white">{value.label}</span>
					<button type="button" aria-label={`Clear ${label}`} onClick={() => onChange(null)} className="text-slate-400 hover:text-slate-700">
						<X size={16} />
					</button>
				</div>
			:	<div className="flex items-center rounded-2xl border border-slate-200 bg-slate-50 pr-3 focus-within:border-slate-400 dark:border-slate-700 dark:bg-slate-700">
					<input
						id={`${id}-input`}
						value={text}
						placeholder={placeholder}
						onFocus={() => setOpen(true)}
						onChange={(event) => {
							setText(event.target.value);
							setOpen(true);
							setActive(0);
						}}
						onKeyDown={onKeyDown}
						role="combobox"
						aria-expanded={open}
						aria-controls={`${id}-list`}
						aria-autocomplete="list"
						aria-activedescendant={open && options[active] ? `${id}-opt-${active}` : undefined}
						required={required && !value}
						autoComplete="off"
						className="w-full bg-transparent px-4 py-3 text-sm text-slate-900 outline-none dark:text-white"
					/>
					<ChevronsUpDown size={16} className="text-slate-400" />
				</div>
			}
			{open && !value ?
				<ul
					id={`${id}-list`}
					role="listbox"
					className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-slate-700 dark:bg-slate-800"
				>
					{results.isFetching && !options.length ?
						<li className="px-3 py-2 text-sm text-slate-400">Searching…</li>
					: options.length === 0 ?
						<li className="px-3 py-2 text-sm text-slate-400">{q ? `No matches for “${q}”` : "Start typing to search"}</li>
					:	options.map((option, index) => (
							<li
								key={option.value}
								id={`${id}-opt-${index}`}
								role="option"
								aria-selected={index === active}
								onMouseEnter={() => setActive(index)}
								onMouseDown={(event) => event.preventDefault()}
								onClick={() => pick(option)}
								className={`flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm ${index === active ? "bg-slate-100 dark:bg-slate-700" : ""}`}
							>
								<Check size={14} className="text-transparent" />
								<span className="min-w-0 flex-1">
									<span className="block truncate text-slate-900 dark:text-white">{option.label}</span>
									{option.hint ? <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{option.hint}</span> : null}
								</span>
							</li>
						))
					}
				</ul>
			:	null}
		</div>
	);
};

export default AsyncCombobox;

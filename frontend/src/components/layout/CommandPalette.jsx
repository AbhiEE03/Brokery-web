import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, CornerDownLeft, FileText, Search, User } from "lucide-react";
import api from "../../api/axiosInstance";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { formatINR } from "../../utils/format";
import { stageLabel } from "../../utils/stages";

const PAGES = [
	{ label: "Dashboard", path: "/dashboard", admin: true },
	{ label: "Clients", path: "/clients" },
	{ label: "Clients · pipeline board", path: "/clients", view: "board" },
	{ label: "Properties", path: "/properties" },
	{ label: "Matches", path: "/matches" },
	{ label: "Change requests", path: "/change-requests" },
	{ label: "Ownership claims", path: "/ownership-claims", admin: true },
	{ label: "Team", path: "/team", admin: true },
	{ label: "Activity log", path: "/activity-log", admin: true },
];

/**
 * Linear-style quick switcher: Ctrl/Cmd+K from anywhere, type to find a page,
 * client (by name) or property (by title, locality or code), Enter to open.
 */
const CommandPalette = ({ open, onClose }) => {
	const navigate = useNavigate();
	const isAdmin = useSelector((state) => state.auth.user?.role === "admin");
	const [text, setText] = useState("");
	const [active, setActive] = useState(0);
	const inputRef = useRef(null);
	const listId = useId();
	const q = useDebouncedValue(text.trim(), 200);

	const clients = useQuery({
		queryKey: ["palette", "clients", q],
		queryFn: async () => (await api.get("/clients", { params: { search: q, limit: 5 } })).data.data,
		enabled: open && q.length >= 2,
	});
	const properties = useQuery({
		queryKey: ["palette", "properties", q],
		queryFn: async () => (await api.get("/properties", { params: { search: q, limit: 5 } })).data.data,
		enabled: open && q.length >= 2,
	});

	const items = useMemo(() => {
		const needle = text.trim().toLowerCase();
		const pages = PAGES.filter((p) => (!p.admin || isAdmin) && (!needle || p.label.toLowerCase().includes(needle))).map((p) => ({
			key: `page-${p.label}`,
			group: "Pages",
			icon: FileText,
			title: p.label,
			go: () => navigate(p.view ? `${p.path}?view=${p.view}` : p.path),
		}));
		const clientItems = (q.length >= 2 ? clients.data || [] : []).map((c) => ({
			key: `client-${c._id}`,
			group: "Clients",
			icon: User,
			title: c.name,
			subtitle: `${c.clientCode} · ${stageLabel(c.pipelineStage)}${c.requirements?.city ? ` · ${c.requirements.city}` : ""}`,
			go: () => navigate(`/clients/${c._id}`),
		}));
		const propertyItems = (q.length >= 2 ? properties.data || [] : []).map((p) => ({
			key: `property-${p._id}`,
			group: "Properties",
			icon: Building2,
			title: p.title,
			subtitle: `${p.propertyCode} · ${formatINR(p.pricing?.askingPrice)} · ${p.location?.locality || p.location?.city || ""}`,
			go: () => navigate(`/properties/${p._id}`),
		}));
		return [...clientItems, ...propertyItems, ...pages];
	}, [text, q, clients.data, properties.data, isAdmin, navigate]);

	useEffect(() => {
		if (open) {
			setText("");
			setActive(0);
			setTimeout(() => inputRef.current?.focus(), 0);
		}
	}, [open]);

	useEffect(() => setActive(0), [q]);

	if (!open) return null;

	const choose = (item) => {
		onClose();
		item.go();
	};

	const onKeyDown = (event) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setActive((i) => Math.min(items.length - 1, i + 1));
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setActive((i) => Math.max(0, i - 1));
		} else if (event.key === "Enter" && items[active]) {
			event.preventDefault();
			choose(items[active]);
		} else if (event.key === "Escape") {
			onClose();
		}
	};

	const loading = q.length >= 2 && (clients.isFetching || properties.isFetching);
	let lastGroup = null;

	return (
		<div className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-950/40 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={onClose}>
			<div
				role="dialog"
				aria-modal="true"
				aria-label="Search"
				onMouseDown={(event) => event.stopPropagation()}
				className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800"
			>
				<div className="flex items-center gap-3 border-b border-slate-100 px-4 dark:border-slate-700">
					<Search size={18} className="text-slate-400" />
					<input
						ref={inputRef}
						value={text}
						onChange={(event) => setText(event.target.value)}
						onKeyDown={onKeyDown}
						role="combobox"
						aria-label="Search"
						aria-expanded="true"
						aria-controls={listId}
						aria-activedescendant={items[active] ? `${listId}-${items[active].key}` : undefined}
						placeholder="Search clients, properties or pages…"
						className="h-14 w-full bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400 dark:text-white"
					/>
					{loading ? <span className="text-xs text-slate-400">Searching…</span> : null}
					<kbd className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 dark:border-slate-600">ESC</kbd>
				</div>

				<ul id={listId} role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
					{items.length === 0 ?
						<li className="px-3 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
							{q.length >= 2 && !loading ? `No results for “${text.trim()}”` : "Type at least 2 letters to search clients and properties"}
						</li>
					:	items.map((item, index) => {
							const header = item.group !== lastGroup ? item.group : null;
							lastGroup = item.group;
							const Icon = item.icon;
							return (
								<li key={item.key} role="presentation">
									{header ?
										<p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{header}</p>
									:	null}
									<div
										id={`${listId}-${item.key}`}
										role="option"
										aria-selected={index === active}
										onMouseEnter={() => setActive(index)}
										onClick={() => choose(item)}
										className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ${
											index === active ? "bg-slate-100 dark:bg-slate-700" : ""
										}`}
									>
										<Icon size={16} className="shrink-0 text-slate-400" />
										<div className="min-w-0 flex-1">
											<p className="truncate text-sm font-medium text-slate-900 dark:text-white">{item.title}</p>
											{item.subtitle ? <p className="truncate text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</p> : null}
										</div>
										{index === active ?
											<CornerDownLeft size={14} className="text-slate-400" />
										:	<ArrowRight size={14} className="text-transparent" />}
									</div>
								</li>
							);
						})
					}
				</ul>
				<div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400 dark:border-slate-700">
					<span>↑↓ to move · Enter to open</span>
					<span>Ctrl K anywhere</span>
				</div>
			</div>
		</div>
	);
};

export default CommandPalette;

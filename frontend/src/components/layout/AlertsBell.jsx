import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, Heart, Sparkles } from "lucide-react";
import { useAlertActions, useAlerts } from "../../hooks/queries";

const timeAgo = (value) => {
	const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
	if (seconds < 60) return "just now";
	if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
	if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
	return `${Math.floor(seconds / 86400)}d ago`;
};

const KIND_ICON = {
	new_match: <Sparkles size={16} className="text-emerald-600" />,
	shortlist_feedback: <Heart size={16} className="text-rose-500" />,
};

/**
 * In-app alerts: re-match alerts and buyer reactions. Polls every 60 s
 * (alerts aren't urgent to the second, and polling keeps the API stateless).
 */
const AlertsBell = () => {
	const [open, setOpen] = useState(false);
	const ref = useRef(null);
	const navigate = useNavigate();
	const query = useAlerts();
	const { markRead, markAllRead } = useAlertActions();
	const alerts = query.data?.data || [];
	const unread = query.data?.meta?.unreadCount || 0;

	useEffect(() => {
		if (!open) return undefined;
		const onClick = (event) => {
			if (!ref.current?.contains(event.target)) setOpen(false);
		};
		const onKey = (event) => {
			if (event.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onClick);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onClick);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	const openAlert = (alert) => {
		if (!alert.readAt) markRead.mutate(alert._id);
		setOpen(false);
		if (alert.href) navigate(alert.href);
	};

	return (
		<div ref={ref} className="relative">
			<button
				type="button"
				onClick={() => setOpen((v) => !v)}
				aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
				aria-expanded={open}
				aria-haspopup="true"
				className="relative grid h-9 w-9 place-items-center rounded-xl text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-white"
			>
				<Bell size={18} />
				{unread ?
					<span className="absolute -right-0.5 -top-0.5 grid min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-[18px] text-white ring-2 ring-white dark:ring-slate-800">
						{unread > 9 ? "9+" : unread}
					</span>
				:	null}
			</button>

			{open ?
				<div
					role="dialog"
					aria-label="Notifications"
					className="absolute right-0 top-11 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-800 xl:left-0 xl:right-auto"
				>
					<div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-700">
						<p className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</p>
						{unread ?
							<button
								type="button"
								onClick={() => markAllRead.mutate()}
								className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
							>
								<CheckCheck size={14} /> Mark all read
							</button>
						:	null}
					</div>
					{alerts.length === 0 ?
						<p className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
							You're all caught up.
							<br />
							<span className="text-xs">New matches and buyer reactions show up here.</span>
						</p>
					:	<ul className="max-h-[26rem] divide-y divide-slate-100 overflow-y-auto dark:divide-slate-700">
							{alerts.map((alert) => (
								<li key={alert._id}>
									<button
										type="button"
										onClick={() => openAlert(alert)}
										className={`flex w-full gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-700/50 ${alert.readAt ? "" : "bg-emerald-50/50 dark:bg-emerald-900/10"}`}
									>
										<span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 dark:bg-slate-700">
											{KIND_ICON[alert.kind]}
										</span>
										<span className="min-w-0 flex-1">
											<span className="block text-sm font-medium leading-snug text-slate-900 dark:text-white">{alert.title}</span>
											{alert.body ?
												<span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{alert.body}</span>
											:	null}
											<span className="mt-1 block text-[11px] text-slate-400">{timeAgo(alert.createdAt)}</span>
										</span>
										{alert.readAt ? null : <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-label="unread" />}
									</button>
								</li>
							))}
						</ul>
					}
				</div>
			:	null}
		</div>
	);
};

export default AlertsBell;

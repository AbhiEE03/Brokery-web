import { useMemo, useState } from "react";
import { CalendarCheck, Check, Copy, Eye, Heart, Link2, MessageCircle, Send, X } from "lucide-react";
import { useClientMatches, useRecommendations, useShortlistMutations, useShortlists } from "../../hooks/queries";
import useConfirmDialog from "../../hooks/useConfirmDialog";
import useToast from "../../hooks/useToast";
import { messageFrom } from "../../utils/errors";
import { formatDateTime, formatINR } from "../../utils/format";
import { EmptyState, LoadingState } from "../ui/States";

const REACTION_ICON = {
	like: <Heart size={13} className="text-rose-500" fill="currentColor" />,
	visit: <CalendarCheck size={13} className="text-emerald-600" />,
	dislike: <X size={13} className="text-slate-500" />,
};

const STATUS_STYLE = {
	active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
	expired: "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300",
	revoked: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
};

const whatsappHref = (firstName, count, url) =>
	`https://wa.me/?text=${encodeURIComponent(
		`Hi ${firstName}, I've shortlisted ${count} ${count === 1 ? "home" : "homes"} for you. Tap the ones you like: ${url}`,
	)}`;

const ShareResult = ({ result, firstName, onDone }) => {
	const toast = useToast();
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(result.url);
			toast.success("Link copied");
		} catch {
			toast.error("Couldn't copy", { description: "Select the link and copy it manually." });
		}
	};
	return (
		<div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
			<p className="flex items-center gap-2 text-sm font-semibold text-emerald-800 dark:text-emerald-300">
				<Check size={16} /> Link ready. Share it now: for security it can't be shown again.
			</p>
			<input
				readOnly
				value={result.url}
				onFocus={(event) => event.target.select()}
				aria-label="Shortlist link"
				className="mt-3 w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 font-mono text-xs text-slate-700 dark:border-emerald-800 dark:bg-slate-900 dark:text-slate-200"
			/>
			<div className="mt-3 flex flex-wrap gap-2">
				<a
					href={whatsappHref(firstName, result.properties.length, result.url)}
					target="_blank"
					rel="noreferrer"
					className="inline-flex items-center gap-2 rounded-xl bg-[#25D366] px-4 py-2 text-sm font-semibold text-white hover:brightness-95"
				>
					<MessageCircle size={16} /> Share on WhatsApp
				</a>
				<button
					type="button"
					onClick={copy}
					className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
				>
					<Copy size={16} /> Copy link
				</button>
				<button type="button" onClick={onDone} className="px-2 text-sm font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400">
					Done
				</button>
			</div>
		</div>
	);
};

/**
 * "Share with buyer": pick properties, create an expiring link, send it on
 * WhatsApp, then watch opens and reactions come in.
 */
const ShortlistPanel = ({ client }) => {
	const firstName = client.name.trim().split(/\s+/)[0];
	const matches = useClientMatches(client._id);
	const recommendations = useRecommendations(client._id);
	const shortlists = useShortlists(client._id);
	const { create, revoke } = useShortlistMutations(client._id);
	const { confirm, dialog } = useConfirmDialog();
	const toast = useToast();
	const [selected, setSelected] = useState([]);
	const [expiresInDays, setExpiresInDays] = useState(7);
	const [result, setResult] = useState(null);

	// Linked properties first, then recommended ones not already linked.
	const options = useMemo(() => {
		const seen = new Set();
		const list = [];
		for (const m of matches.data || []) {
			if (m.property && !seen.has(m.property._id)) {
				seen.add(m.property._id);
				list.push({ ...m.property, source: "Linked" });
			}
		}
		for (const r of recommendations.data?.data || []) {
			if (!seen.has(r.property._id)) {
				seen.add(r.property._id);
				list.push({ ...r.property, source: `${Math.round(r.score * 100)}% match` });
			}
		}
		return list;
	}, [matches.data, recommendations.data]);

	const toggle = (id) => setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));

	const submit = () =>
		create.mutate(
			{ propertyIds: selected, expiresInDays },
			{
				onSuccess: (response) => {
					setResult(response.data);
					setSelected([]);
				},
				onError: (error) => toast.error("Couldn't create the link", { description: messageFrom(error) }),
			},
		);

	const revokeLink = async (link) => {
		const ok = await confirm({
			title: "Turn off this link?",
			message: `${firstName} will see "This link isn't available" if they open it again.`,
			confirmLabel: "Turn off link",
			tone: "danger",
		});
		if (!ok) return;
		revoke.mutate(link._id, {
			onSuccess: () => toast.info("Link turned off"),
			onError: (error) => toast.error("Couldn't turn off the link", { description: messageFrom(error) }),
		});
	};

	return (
		<section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-8 xl:col-span-2">
			{dialog}
			<p className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
				<Send size={16} /> Share with buyer
			</p>
			<h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Shortlist link</h2>
			<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
				Send {firstName} one link on WhatsApp. They can like, book a visit or pass on each home without an account, and
				you'll be notified as they tap.
			</p>

			<div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
				<div>
					{result ?
						<ShareResult result={result} firstName={firstName} onDone={() => setResult(null)} />
					: matches.isPending || recommendations.isPending ?
						<LoadingState label="Loading properties..." />
					: options.length === 0 ?
						<EmptyState title="No properties to share yet" hint="Link a property or use the recommendations above first." />
					:	<>
							<fieldset>
								<legend className="text-sm font-semibold text-slate-700 dark:text-slate-200">Pick properties ({selected.length} selected)</legend>
								<ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
									{options.map((p) => (
										<li key={p._id}>
											<label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm transition has-[:checked]:border-emerald-400 has-[:checked]:bg-emerald-50/60 dark:border-slate-700 dark:has-[:checked]:bg-emerald-900/20">
												<input
													type="checkbox"
													checked={selected.includes(p._id)}
													onChange={() => toggle(p._id)}
													className="h-4 w-4 accent-emerald-600"
												/>
												<span className="min-w-0 flex-1">
													<span className="block truncate font-medium text-slate-900 dark:text-white">{p.title}</span>
													<span className="text-xs text-slate-500 dark:text-slate-400">
														{formatINR(p.pricing?.askingPrice)} · {p.location?.locality || p.location?.city}
													</span>
												</span>
												<span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
													{p.source}
												</span>
											</label>
										</li>
									))}
								</ul>
							</fieldset>
							<div className="mt-4 flex flex-wrap items-center gap-3">
								<label className="text-sm text-slate-600 dark:text-slate-300">
									Expires in{" "}
									<select
										value={expiresInDays}
										onChange={(event) => setExpiresInDays(Number(event.target.value))}
										className="ml-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-700"
									>
										{[3, 7, 14, 30].map((d) => (
											<option key={d} value={d}>
												{d} days
											</option>
										))}
									</select>
								</label>
								<button
									type="button"
									disabled={!selected.length || create.isPending}
									onClick={submit}
									className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-950"
								>
									<Link2 size={16} /> {create.isPending ? "Creating..." : "Create link"}
								</button>
							</div>
						</>
					}
				</div>

				<div>
					<h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Sent links</h3>
					{shortlists.isPending ?
						<LoadingState />
					: !shortlists.data?.length ?
						<p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No links sent yet.</p>
					:	<ul className="mt-3 space-y-3">
							{shortlists.data.map((link) => {
								const titles = new Map(link.properties.map((p) => [p._id, p.title]));
								return (
									<li key={link._id} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-slate-700">
										<div className="flex flex-wrap items-center justify-between gap-2">
											<span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[link.status]}`}>
												{link.status}
											</span>
											<span className="text-xs text-slate-500 dark:text-slate-400">
												{link.properties.length} homes · sent {formatDateTime(link.createdAt)}
											</span>
										</div>
										<p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
											<Eye size={13} />
											{link.openCount ? `Opened ${link.openCount}× · last ${formatDateTime(link.lastOpenedAt)}` : "Not opened yet"}
										</p>
										{link.feedback.length ?
											<ul className="mt-2 space-y-1">
												{link.feedback.map((f) => (
													<li key={f.property} className="flex items-start gap-1.5 text-xs text-slate-700 dark:text-slate-200">
														{REACTION_ICON[f.reaction]}
														<span>
															{titles.get(f.property) || "A property"}
															{f.comment ? <span className="text-slate-500 dark:text-slate-400"> · “{f.comment}”</span> : null}
														</span>
													</li>
												))}
											</ul>
										:	null}
										{link.status === "active" ?
											<button
												type="button"
												onClick={() => revokeLink(link)}
												className="mt-2 text-xs font-semibold text-rose-600 hover:underline"
											>
												Turn off link
											</button>
										:	null}
									</li>
								);
							})}
						</ul>
					}
				</div>
			</div>
		</section>
	);
};

export default ShortlistPanel;

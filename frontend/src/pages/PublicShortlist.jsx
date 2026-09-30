import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bath, BedDouble, Building2, CalendarCheck, Car, Heart, Link2Off, MapPin, Maximize2, X } from "lucide-react";
import { getPublicShortlist, sendShortlistFeedback } from "../api/publicApi";
import { formatDate, formatINR } from "../utils/format";

const REACTIONS = [
	{ key: "like", label: "Love it", icon: Heart, on: "bg-rose-500 text-white border-rose-500", hover: "hover:border-rose-300 hover:text-rose-600" },
	{ key: "visit", label: "Book a visit", icon: CalendarCheck, on: "bg-emerald-600 text-white border-emerald-600", hover: "hover:border-emerald-300 hover:text-emerald-700" },
	{ key: "dislike", label: "Not for me", icon: X, on: "bg-slate-800 text-white border-slate-800", hover: "hover:border-slate-400 hover:text-slate-800" },
];

const Spec = ({ icon: Icon, children }) => (
	<span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
		<Icon size={14} className="text-slate-500" />
		{children}
	</span>
);

// Keep this page out of search engines while it's mounted.
const useNoIndex = () => {
	useEffect(() => {
		const meta = document.createElement("meta");
		meta.name = "robots";
		meta.content = "noindex, nofollow";
		document.head.appendChild(meta);
		const previousTitle = document.title;
		document.title = "Your property shortlist";
		return () => {
			meta.remove();
			document.title = previousTitle;
		};
	}, []);
};

const PropertyCard = ({ property, token, brokerName }) => {
	const queryClient = useQueryClient();
	const [note, setNote] = useState(property.feedback?.comment || "");
	const [noteOpen, setNoteOpen] = useState(false);
	const current = property.feedback?.reaction;

	const send = useMutation({
		mutationFn: (payload) => sendShortlistFeedback(token, { propertyId: property._id, ...payload }),
		onSuccess: () => queryClient.invalidateQueries({ queryKey: ["publicShortlist", token] }),
	});

	const react = (reaction) => {
		send.mutate({ reaction, comment: note || undefined });
		setNoteOpen(true);
	};

	const specs = property.specs;
	const unavailable = property.status && property.status !== "available";

	return (
		<article className="overflow-hidden rounded-3xl bg-white shadow-lg shadow-slate-900/5 ring-1 ring-slate-200">
			<div className="relative">
				{property.images[0] ?
					<img src={property.images[0]} alt={property.title} className="aspect-[4/3] w-full object-cover" loading="lazy" />
				:	<div className="flex aspect-[4/3] w-full items-center justify-center bg-gradient-to-br from-emerald-100 via-slate-100 to-sky-100">
						<Building2 size={48} className="text-emerald-700/40" />
					</div>
				}
				{property.images.length > 1 ?
					<span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
						1 / {property.images.length}
					</span>
				:	null}
				{unavailable ?
					<span className="absolute left-3 top-3 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-900">
						{property.status.replace("_", " ")}
					</span>
				:	null}
			</div>

			<div className="space-y-4 p-5">
				<div>
					<p className="text-2xl font-bold tracking-tight text-slate-950">{formatINR(property.price)}</p>
					<h2 className="mt-1 text-base font-semibold text-slate-800">{property.title}</h2>
					<p className="mt-1 inline-flex items-center gap-1 text-sm text-slate-500">
						<MapPin size={14} />
						{[property.location.locality, property.location.city].filter(Boolean).join(", ")}
					</p>
				</div>

				<div className="flex flex-wrap gap-2">
					{specs.bedrooms ? <Spec icon={BedDouble}>{specs.bedrooms} BHK</Spec> : null}
					{specs.area ? <Spec icon={Maximize2}>{specs.area.toLocaleString("en-IN")} sq ft</Spec> : null}
					{specs.bathrooms ? <Spec icon={Bath}>{specs.bathrooms} bath</Spec> : null}
					{specs.parking ? <Spec icon={Car}>Parking</Spec> : null}
					{specs.furnished ? <Spec icon={Building2}>{specs.furnished.replace("-", " ")}</Spec> : null}
				</div>

				<div role="group" aria-label={`Your reaction to ${property.title}`} className="grid grid-cols-3 gap-2">
					{REACTIONS.map(({ key, label, icon: Icon, on, hover }) => {
						const selected = current === key;
						return (
							<button
								key={key}
								type="button"
								aria-pressed={selected}
								disabled={send.isPending}
								onClick={() => react(key)}
								className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-xs font-semibold transition active:scale-95 disabled:opacity-60 ${
									selected ? on : `border-slate-200 bg-white text-slate-600 ${hover}`
								}`}
							>
								<Icon size={20} fill={selected && key === "like" ? "currentColor" : "none"} />
								{label}
							</button>
						);
					})}
				</div>

				{send.isError ?
					<p role="alert" className="text-sm text-rose-600">
						{send.error.status === 404 ? "This link has expired." : "Couldn't send that. Please try again."}
					</p>
				: current && !send.isPending ?
					<p role="status" className="text-sm text-emerald-700">
						{brokerName ? `${brokerName} has been told.` : "Your broker has been told."}
					</p>
				:	null}

				{noteOpen || property.feedback?.comment ?
					<form
						onSubmit={(event) => {
							event.preventDefault();
							if (current) send.mutate({ reaction: current, comment: note || undefined });
						}}
						className="flex gap-2"
					>
						<label className="sr-only" htmlFor={`note-${property._id}`}>
							Note for your broker
						</label>
						<input
							id={`note-${property._id}`}
							value={note}
							maxLength={500}
							onChange={(event) => setNote(event.target.value)}
							placeholder={`Add a note for ${brokerName || "your broker"} (optional)`}
							className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
						/>
						<button
							type="submit"
							disabled={!current || send.isPending}
							className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
						>
							Send
						</button>
					</form>
				:	null}
			</div>
		</article>
	);
};

const PublicShortlist = () => {
	const { token } = useParams();
	useNoIndex();
	const query = useQuery({
		queryKey: ["publicShortlist", token],
		queryFn: () => getPublicShortlist(token),
		retry: false,
		refetchOnWindowFocus: false,
	});
	const data = query.data?.data;

	return (
		<div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-white text-slate-900">
			<div className="mx-auto max-w-xl px-4 pb-16 pt-8 sm:pt-12">
				<header className="mb-6 flex items-center gap-2 text-sm font-semibold text-emerald-700">
					<Building2 size={18} /> Brokery
				</header>

				{query.isPending ?
					<p role="status" className="text-slate-500">
						Loading your shortlist…
					</p>
				: query.isError ?
					<div className="rounded-3xl bg-white p-8 text-center shadow-lg ring-1 ring-slate-200">
						<Link2Off size={36} className="mx-auto text-slate-400" />
						<h1 className="mt-4 text-xl font-bold">This link isn't available</h1>
						<p className="mt-2 text-sm text-slate-500">
							It may have expired or been turned off. Ask your broker to send you a fresh one.
						</p>
					</div>
				:	<>
						<h1 className="text-3xl font-bold tracking-tight">
							{data.buyerFirstName ? `Hi ${data.buyerFirstName},` : "Hi,"}
						</h1>
						<p className="mt-2 text-slate-600">
							{data.brokerName || "Your broker"} picked {data.properties.length}{" "}
							{data.properties.length === 1 ? "home" : "homes"} for you. Tap what you like, and they'll be notified right away.
						</p>
						<p className="mt-1 text-xs text-slate-400">Link valid until {formatDate(data.expiresAt)}</p>

						<div className="mt-8 space-y-6">
							{data.properties.map((property) => (
								<PropertyCard key={property._id} property={property} token={token} brokerName={data.brokerName} />
							))}
						</div>
					</>
				}
			</div>
		</div>
	);
};

export default PublicShortlist;

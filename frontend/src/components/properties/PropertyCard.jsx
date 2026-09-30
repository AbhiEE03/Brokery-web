import { BedDouble, Building2, MapPin, Maximize2 } from "lucide-react";
import { formatINR } from "../../utils/format";

const STATUS = {
	available: { label: "Available", className: "bg-emerald-500 text-white" },
	under_negotiation: { label: "Under negotiation", className: "bg-amber-400 text-slate-900" },
	sold: { label: "Sold", className: "bg-slate-800 text-white" },
	withdrawn: { label: "Withdrawn", className: "bg-slate-400 text-white" },
};

const GRADIENTS = {
	flat: "from-sky-100 via-slate-100 to-emerald-100",
	villa: "from-emerald-100 via-lime-50 to-amber-100",
	plot: "from-amber-100 via-orange-50 to-lime-100",
	commercial: "from-violet-100 via-slate-100 to-sky-100",
};

/** Listing card in the style of property portals: photo first, then price. */
const PropertyCard = ({ property, onOpen }) => {
	const status = STATUS[property.status] || STATUS.available;
	const price = property.pricing?.askingPrice;
	const area = property.specs?.area;
	const perSqft = price && area ? Math.round(price / area) : property.pricing?.pricePerSqft;
	const image = property.images?.[0]?.url;

	return (
		<button
			type="button"
			onClick={onOpen}
			className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800"
		>
			<div className="relative">
				{image ?
					<img src={image} alt="" loading="lazy" className="aspect-[16/10] w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
				:	<div className={`flex aspect-[16/10] w-full items-center justify-center bg-gradient-to-br ${GRADIENTS[property.propertyType] || GRADIENTS.flat} dark:from-slate-700 dark:via-slate-800 dark:to-slate-700`}>
						<Building2 size={40} className="text-slate-500/40 dark:text-slate-400/40" />
					</div>
				}
				<span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide shadow-sm ${status.className}`}>
					{status.label}
				</span>
				<span className="absolute right-3 top-3 rounded-full bg-white/90 px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700 dark:bg-slate-900/80 dark:text-slate-200">
					{property.propertyCode}
				</span>
			</div>

			<div className="flex flex-1 flex-col gap-2 p-4">
				<p className="text-xl font-bold tracking-tight text-slate-950 dark:text-white">
					{price ? formatINR(price) : "Price on request"}
					{perSqft ?
						<span className="ml-2 text-xs font-medium text-slate-500 dark:text-slate-400">₹{perSqft.toLocaleString("en-IN")}/sq ft</span>
					:	null}
				</p>
				<h3 className="line-clamp-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{property.title}</h3>
				<p className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
					<MapPin size={13} />
					{[property.location?.locality, property.location?.city].filter(Boolean).join(", ") || "Location not set"}
				</p>
				<div className="mt-auto flex flex-wrap gap-1.5 pt-2">
					{property.specs?.bedrooms ?
						<span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
							<BedDouble size={12} /> {property.specs.bedrooms} BHK
						</span>
					:	null}
					{area ?
						<span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
							<Maximize2 size={12} /> {area.toLocaleString("en-IN")} sq ft
						</span>
					:	null}
					<span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium capitalize text-slate-700 dark:bg-slate-700 dark:text-slate-200">
						{property.propertyType || "property"}
					</span>
				</div>
			</div>
		</button>
	);
};

export default PropertyCard;

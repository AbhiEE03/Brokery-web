import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { createProperty, getProperties } from "../api/propertyApi";

const typeOptions = ["all", "flat", "villa", "plot", "commercial"];
const statusOptions = [
	"all",
	"available",
	"under_negotiation",
	"sold",
	"withdrawn",
];

const Properties = () => {
	const navigate = useNavigate();
	const [properties, setProperties] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [searchTerm, setSearchTerm] = useState("");
	const [city, setCity] = useState("");
	const [type, setType] = useState("all");
	const [status, setStatus] = useState("all");
	const [formOpen, setFormOpen] = useState(false);
	const [creating, setCreating] = useState(false);
	const [formData, setFormData] = useState({
		title: "",
		propertyType: "flat",
		location: { city: "", locality: "" },
		pricing: { askingPrice: "" },
	});

	const queryParams = useMemo(
		() => ({
			search: searchTerm || undefined,
			city: city || undefined,
			type: type === "all" ? undefined : type,
			status: status === "all" ? undefined : status,
			page: 1,
			limit: 100,
		}),
		[searchTerm, city, type, status],
	);

	useEffect(() => {
		let isMounted = true;

		const loadProperties = async () => {
			setLoading(true);
			setError("");

			try {
				const response = await getProperties(queryParams);
				if (!isMounted) return;
				setProperties(response.data || []);
			} catch (err) {
				if (!isMounted) return;
				setError(err.response?.data?.message || "Failed to load properties.");
			} finally {
				if (isMounted) setLoading(false);
			}
		};

		loadProperties();

		return () => {
			isMounted = false;
		};
	}, [queryParams]);

	const handleSubmit = async (event) => {
		event.preventDefault();
		setCreating(true);
		setError("");

		try {
			await createProperty(formData);
			setFormData({
				title: "",
				propertyType: "flat",
				location: { city: "", locality: "" },
				pricing: { askingPrice: "" },
			});
			setFormOpen(false);
			const response = await getProperties(queryParams);
			setProperties(response.data || []);
		} catch (err) {
			setError(err.response?.data?.message || "Unable to create property.");
		} finally {
			setCreating(false);
		}
	};

	return (
		<section className="p-6 sm:p-8">
			<div className="flex flex-col gap-6">
				<header className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm sm:p-8 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
							Inventory
						</p>
						<h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
							Properties
						</h1>
						<p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
							Filter listings by city, type, and status, then open any property
							for details or editing.
						</p>
					</div>

					<button
						type="button"
						onClick={() => setFormOpen((open) => !open)}
						className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
					>
						<Plus size={18} />
						New Property
					</button>
				</header>

				<div className="grid gap-4 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[1fr_180px_180px_180px] lg:items-center lg:p-5">
					<label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 focus-within:border-slate-400 lg:col-span-1">
						<Search size={18} className="text-slate-400" />
						<input
							type="search"
							value={searchTerm}
							onChange={(event) => setSearchTerm(event.target.value)}
							placeholder="Search property title"
							className="w-full bg-transparent text-sm text-slate-950 outline-none placeholder:text-slate-400"
						/>
					</label>

					<input
						type="text"
						value={city}
						onChange={(event) => setCity(event.target.value)}
						placeholder="City"
						className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
					/>

					<select
						value={type}
						onChange={(event) => setType(event.target.value)}
						className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400"
					>
						{typeOptions.map((option) => (
							<option key={option} value={option}>
								{option === "all" ? "All types" : option}
							</option>
						))}
					</select>

					<select
						value={status}
						onChange={(event) => setStatus(event.target.value)}
						className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400"
					>
						{statusOptions.map((option) => (
							<option key={option} value={option}>
								{option === "all" ? "All statuses" : option.replace("_", " ")}
							</option>
						))}
					</select>
				</div>

				{formOpen ?
					<form
						onSubmit={handleSubmit}
						className="grid gap-4 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2"
					>
						<label className="block sm:col-span-2">
							<span className="mb-2 block text-sm font-medium text-slate-600">
								Title
							</span>
							<input
								type="text"
								value={formData.title}
								onChange={(event) =>
									setFormData((current) => ({
										...current,
										title: event.target.value,
									}))
								}
								className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
								required
							/>
						</label>

						<label className="block">
							<span className="mb-2 block text-sm font-medium text-slate-600">
								Property Type
							</span>
							<select
								value={formData.propertyType}
								onChange={(event) =>
									setFormData((current) => ({
										...current,
										propertyType: event.target.value,
									}))
								}
								className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
							>
								{typeOptions
									.filter((option) => option !== "all")
									.map((option) => (
										<option key={option} value={option}>
											{option}
										</option>
									))}
							</select>
						</label>

						<label className="block">
							<span className="mb-2 block text-sm font-medium text-slate-600">
								Asking Price
							</span>
							<input
								type="number"
								value={formData.pricing.askingPrice}
								onChange={(event) =>
									setFormData((current) => ({
										...current,
										pricing: {
											...current.pricing,
											askingPrice: event.target.value,
										},
									}))
								}
								className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
								required
							/>
						</label>

						<label className="block">
							<span className="mb-2 block text-sm font-medium text-slate-600">
								City
							</span>
							<input
								type="text"
								value={formData.location.city}
								onChange={(event) =>
									setFormData((current) => ({
										...current,
										location: { ...current.location, city: event.target.value },
									}))
								}
								className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
								required
							/>
						</label>

						<label className="block">
							<span className="mb-2 block text-sm font-medium text-slate-600">
								Locality
							</span>
							<input
								type="text"
								value={formData.location.locality}
								onChange={(event) =>
									setFormData((current) => ({
										...current,
										location: {
											...current.location,
											locality: event.target.value,
										},
									}))
								}
								className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
							/>
						</label>

						<div className="sm:col-span-2 flex justify-end gap-3">
							<button
								type="button"
								onClick={() => setFormOpen(false)}
								className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700"
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={creating}
								className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-70"
							>
								{creating ? "Creating..." : "Create Property"}
							</button>
						</div>
					</form>
				:	null}

				{error ?
					<div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
						{error}
					</div>
				:	null}

				<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
					{loading ?
						<div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm sm:col-span-2 xl:col-span-3">
							Loading properties...
						</div>
					: properties.length === 0 ?
						<div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm sm:col-span-2 xl:col-span-3">
							No properties found.
						</div>
					:	properties.map((property) => (
							<button
								key={property._id}
								type="button"
								onClick={() => navigate(`/properties/${property._id}`)}
								className="group rounded-[2rem] border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg"
							>
								<div className="flex items-start justify-between gap-3">
									<div>
										<p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
											{property.propertyCode}
										</p>
										<h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950">
											{property.title}
										</h3>
									</div>
									<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
										{property.status?.replace("_", " ")}
									</span>
								</div>

								<div className="mt-5 space-y-3 text-sm text-slate-600">
									<p>{property.location?.city || "Unknown city"}</p>
									<p className="capitalize">{property.propertyType}</p>
									<p>
										{property.pricing?.askingPrice ?
											`INR ${Number(property.pricing.askingPrice).toLocaleString("en-IN")}`
										:	"Price unavailable"}
									</p>
								</div>
							</button>
						))
					}
				</div>
			</div>
		</section>
	);
};

export default Properties;

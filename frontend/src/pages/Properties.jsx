import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { createProperty } from "../api/propertyApi";
import { useProperties } from "../hooks/queries";
import useDebouncedValue from "../hooks/useDebouncedValue";
import Pagination from "../components/ui/Pagination";
import { messageFrom } from "../utils/errors";
import PropertyCard from "../components/properties/PropertyCard";

const PAGE_SIZE = 12;

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
	const queryClient = useQueryClient();
	const [page, setPage] = useState(1);
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

	const debouncedSearch = useDebouncedValue(searchTerm.trim());
	const debouncedCity = useDebouncedValue(city.trim());
	const query = useProperties({
		search: debouncedSearch || undefined,
		city: debouncedCity || undefined,
		type: type === "all" ? undefined : type,
		status: status === "all" ? undefined : status,
		page,
		limit: PAGE_SIZE,
	});
	const properties = query.data?.data || [];
	const pagination = query.data?.pagination || { page: 1, pages: 1 };
	const loading = query.isPending;
	const listError =
		query.isError ? messageFrom(query.error, "Failed to load properties.") : "";

	// Any filter change starts again from page 1.
	const withReset = (setter) => (value) => {
		setter(value);
		setPage(1);
	};

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
			await queryClient.invalidateQueries({ queryKey: ["properties"] });
		} catch (err) {
			setError(messageFrom(err, "Unable to create property."));
		} finally {
			setCreating(false);
		}
	};

	return (
		<section className="p-6 sm:p-8">
			<div className="flex flex-col gap-6">
				<header className="mb-6 flex flex-col gap-1 border-b border-slate-200 pb-5 dark:border-slate-700 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
							Properties
						</h1>
						<p className="mt-1 text-sm text-slate-500 dark:text-slate-400 dark:text-slate-400">
							All listings in one place. Filter by city, type, or status.
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

				<div className="grid gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm lg:grid-cols-[1fr_180px_180px_180px] lg:items-center lg:p-5">
					<label className="flex items-center gap-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 px-4 py-3 focus-within:border-slate-400 lg:col-span-1">
						<Search size={18} className="text-slate-400" />
						<input
							type="search"
							value={searchTerm}
							onChange={(event) => withReset(setSearchTerm)(event.target.value)}
							placeholder="Search property title"
							className="w-full bg-transparent text-sm text-slate-950 dark:text-white outline-none placeholder:text-slate-400"
						/>
					</label>

					<input
						type="text"
						value={city}
						onChange={(event) => withReset(setCity)(event.target.value)}
						placeholder="City"
						className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm text-slate-950 dark:text-white outline-none transition focus:border-slate-400"
					/>

					<select
						value={type}
						onChange={(event) => withReset(setType)(event.target.value)}
						className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none transition focus:border-slate-400"
					>
						{typeOptions.map((option) => (
							<option key={option} value={option}>
								{option === "all" ? "All types" : option}
							</option>
						))}
					</select>

					<select
						value={status}
						onChange={(event) => withReset(setStatus)(event.target.value)}
						className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm font-medium text-slate-700 dark:text-slate-300 outline-none transition focus:border-slate-400"
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
						className="grid gap-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm sm:grid-cols-2"
					>
						<label className="block sm:col-span-2">
							<span className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-400 dark:text-slate-400">
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
								className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm text-slate-950 dark:text-white outline-none transition focus:border-slate-400"
								required
							/>
						</label>

						<label className="block">
							<span className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-400 dark:text-slate-400">
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
								className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm text-slate-950 dark:text-white outline-none transition focus:border-slate-400"
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
							<span className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-400 dark:text-slate-400">
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
								className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm text-slate-950 dark:text-white outline-none transition focus:border-slate-400"
								required
							/>
						</label>

						<label className="block">
							<span className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-400 dark:text-slate-400">
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
								className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm text-slate-950 dark:text-white outline-none transition focus:border-slate-400"
								required
							/>
						</label>

						<label className="block">
							<span className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-400 dark:text-slate-400">
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
								className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 px-4 py-3 text-sm text-slate-950 dark:text-white outline-none transition focus:border-slate-400"
							/>
						</label>

						<div className="sm:col-span-2 flex justify-end gap-3">
							<button
								type="button"
								onClick={() => setFormOpen(false)}
								className="rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300"
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

				{error || listError ?
					<div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
						{error || listError}
					</div>
				:	null}

				<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
					{loading ?
						<div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:text-slate-400 shadow-sm sm:col-span-2 xl:col-span-3">
							Loading properties...
						</div>
					: properties.length === 0 ?
						<div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-sm text-slate-500 dark:text-slate-400 shadow-sm sm:col-span-2 xl:col-span-3">
							No properties found.
						</div>
					:	properties.map((property) => (
							<PropertyCard
								key={property._id}
								property={property}
								onOpen={() => navigate(`/properties/${property._id}`)}
							/>
						))
					}
				</div>

				{pagination.pages > 1 ?
					<div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700">
						<Pagination
							page={pagination.page}
							pages={pagination.pages}
							total={pagination.total}
							onPageChange={setPage}
						/>
					</div>
				:	null}
			</div>
		</section>
	);
};

export default Properties;

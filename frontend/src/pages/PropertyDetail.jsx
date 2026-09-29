import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, Image, Save } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { getPropertyById, updateProperty, uploadPropertyImage } from "../api/propertyApi";
import { useEditPolicies } from "../hooks/queries";
import RecordHistory from "../components/RecordHistory";
import EditPreview from "../components/EditPreview";
import { buildPatch, changedPaths, classifyChanges } from "../utils/diff";
import { messageFrom } from "../utils/errors";

const NUMERIC_FIELDS = new Set(["pricing.askingPrice"]);

const FIELDS = [
	["title", "Title"],
	["propertyType", "Property Type", ["flat", "villa", "plot", "commercial"]],
	["status", "Status", ["available", "under_negotiation", "sold", "withdrawn"]],
	["pricing.askingPrice", "Asking Price"],
	["location.city", "City"],
	["location.locality", "Locality"],
	["location.sector", "Sector"],
	["location.pincode", "Pincode"],
];

const toForm = (property) => ({
	title: property.title || "",
	propertyType: property.propertyType || "flat",
	status: property.status || "available",
	location: {
		city: property.location?.city || "",
		locality: property.location?.locality || "",
		sector: property.location?.sector || "",
		pincode: property.location?.pincode || "",
	},
	pricing: { askingPrice: property.pricing?.askingPrice ?? "" },
});

const readPath = (object, path) => path.split(".").reduce((node, key) => node?.[key], object);

const PropertyDetail = () => {
	const { id } = useParams();
	const navigate = useNavigate();
	const [property, setProperty] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [notice, setNotice] = useState("");
	const [saving, setSaving] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [uploadMessage, setUploadMessage] = useState("");
	const [uploadError, setUploadError] = useState("");
	const [imageFile, setImageFile] = useState(null);
	const [initialForm, setInitialForm] = useState(null);
	const queryClient = useQueryClient();
	const { data: policies } = useEditPolicies();
	const [formData, setFormData] = useState({
		title: "",
		propertyType: "flat",
		status: "available",
		location: { city: "", locality: "", sector: "", pincode: "" },
		pricing: { askingPrice: "" },
	});

	const loadProperty = useCallback(async ({ setBusy = false, mountedCheck = () => true } = {}) => {
		if (setBusy) setLoading(true);
		setError("");

		try {
			const response = await getPropertyById(id);
			if (!mountedCheck()) return;

			const currentProperty = response.data;
			setProperty(currentProperty);
			setFormData(toForm(currentProperty));
			setInitialForm(toForm(currentProperty));
		} catch (err) {
			if (!mountedCheck()) return;
			setError(err.response?.data?.message || "Failed to load property.");
		} finally {
			if (mountedCheck() && setBusy) setLoading(false);
		}
	}, [id]);

	useEffect(() => {
		let isMounted = true;

		loadProperty({ setBusy: true, mountedCheck: () => isMounted });

		return () => {
			isMounted = false;
		};
	}, [loadProperty]);

	const changed = initialForm ? changedPaths(initialForm, formData) : [];
	const preview = classifyChanges(changed, policies?.property, policies?.appliesDirectly);
	const needsApproval = (field) => !policies?.appliesDirectly && policies?.property.approval.includes(field);

	const handleChange = (event) => {
		const { name, value } = event.target;
		if (name.startsWith("location.")) {
			const key = name.split(".")[1];
			setFormData((current) => ({
				...current,
				location: { ...current.location, [key]: value },
			}));
			return;
		}

		if (name.startsWith("pricing.")) {
			const key = name.split(".")[1];
			setFormData((current) => ({
				...current,
				pricing: { ...current.pricing, [key]: value },
			}));
			return;
		}

		setFormData((current) => ({ ...current, [name]: value }));
	};

	const handleSubmit = async (event) => {
		event.preventDefault();
		setNotice("");
		if (!changed.length) {
			setNotice("Nothing to save. No fields were changed.");
			return;
		}
		setSaving(true);

		try {
			// Only the fields the user actually changed.
			const response = await updateProperty(id, buildPatch(changed, formData, NUMERIC_FIELDS));
			const updatedProperty = response.data.updated || property;
			setProperty((current) => (updatedProperty ? { ...current, ...updatedProperty } : current));
			setFormData(toForm(updatedProperty));
			setInitialForm(toForm(updatedProperty));
			setNotice(response.message || "");
			queryClient.invalidateQueries({ queryKey: ["history", id] });
		} catch (err) {
			setNotice(messageFrom(err, "Unable to save property."));
		} finally {
			setSaving(false);
		}
	};

	const handleImageUpload = async (event) => {
		event.preventDefault();
		setUploading(true);
		setUploadError("");
		setUploadMessage("");

		try {
			if (!imageFile) {
				throw new Error("Please choose an image to upload.");
			}

			const formData = new FormData();
			formData.append("file", imageFile);

			await uploadPropertyImage(id, formData);
			setImageFile(null);
			setUploadMessage("Image uploaded successfully.");
			await loadProperty({ setBusy: false });
		} catch (err) {
			setUploadError(err.response?.data?.message || err.message || "Unable to upload image.");
		} finally {
			setUploading(false);
		}
	};

	return (
		<section className="p-6 sm:p-8">
			<div className="flex flex-col gap-6">
				<button
					type="button"
					onClick={() => navigate("/properties")}
					className="inline-flex w-fit items-center gap-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 dark:text-slate-300 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-700/50"
				>
					<ArrowLeft size={18} />
					Back to Properties
				</button>

				{loading ?
					<div className="rounded-[2rem] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-sm text-slate-500 dark:text-slate-400 shadow-sm">
						Loading property details...
					</div>
				: error ?
					<div className="rounded-[2rem] border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 p-8 text-sm text-rose-700 dark:text-rose-400 shadow-sm">
						{error}
					</div>
				: property ?
					<div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
						<article className="rounded-[2rem] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm sm:p-8">
							<p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
								Property profile
							</p>
							<h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">
								{property.title}
							</h1>
							<p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
								{property.propertyCode}
							</p>

							<div className="mt-6 grid gap-4 sm:grid-cols-2">
								{[
									["Type", property.propertyType],
									["Status", property.status],
									["City", property.location?.city],
									["Locality", property.location?.locality],
									[
										"Price",
										property.pricing?.askingPrice ?
											`INR ${Number(property.pricing.askingPrice).toLocaleString("en-IN")}`
										:	"Not provided",
									],
									["Added By", property.addedBy?.name || "Unknown"],
								].map(([label, value]) => (
									<div
										key={label}
										className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 p-4"
									>
										<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
											{label}
										</p>
										<p className="mt-2 text-sm font-medium text-slate-950 dark:text-white">
											{value || "Not specified"}
										</p>
									</div>
								))}
							</div>
						</article>

						<aside className="rounded-[2rem] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm sm:p-8">
							<h2 className="text-xl font-semibold text-slate-950 dark:text-white">
								Edit property
							</h2>
							<p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-400">
								{policies?.appliesDirectly ?
									"As an admin, your edits apply immediately (and are recorded in the history)."
								:	"Most fields save immediately. Fields marked “needs approval” are sent to an admin first."}
							</p>

							<form className="mt-6 space-y-4" onSubmit={handleSubmit}>
								{FIELDS.map(([name, label, options]) => {
									const value = readPath(formData, name);
									const inputClass = `w-full rounded-2xl border bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-400 dark:bg-slate-700/50 dark:text-white ${
										changed.includes(name) ? "border-sky-400 dark:border-sky-500" : "border-slate-200 dark:border-slate-700"
									}`;
									return (
										<label key={name} className="block">
											<span className="mb-2 flex items-center justify-between text-sm font-medium text-slate-600 dark:text-slate-400">
												{label}
												{needsApproval(name) ?
													<span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
														needs approval
													</span>
												:	null}
											</span>
											{options ?
												<select name={name} value={value} onChange={handleChange} className={inputClass}>
													{options.map((option) => (
														<option key={option} value={option}>
															{option.replace(/_/g, " ")}
														</option>
													))}
												</select>
											:	<input
													type={NUMERIC_FIELDS.has(name) ? "number" : "text"}
													min={NUMERIC_FIELDS.has(name) ? 0 : undefined}
													name={name}
													value={value}
													onChange={handleChange}
													required={name === "title" || name === "location.city"}
													className={inputClass}
												/>
											}
										</label>
									);
								})}

								<EditPreview preview={preview} />

								<button
									type="submit"
									disabled={saving}
									className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 dark:bg-slate-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
								>
									<Save size={18} />
									{saving ? "Saving..." : "Save Changes"}
								</button>
							</form>

							{notice ?
								<div className="mt-4 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm text-amber-800 dark:text-amber-400">
									{notice}
								</div>
							:	null}
						</aside>

						<RecordHistory entityId={id} />

						<section className="rounded-[2rem] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm sm:p-8 xl:col-span-2">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div>
									<p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
										Images
									</p>
									<h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">
										Property images
									</h2>
								</div>
								<div className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 dark:bg-slate-700 px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
									<Image size={16} />
									{property.images?.length || 0} images
								</div>
							</div>

							<div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
								<div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 p-4">
									<h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
										Existing images
									</h3>
									<div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
										{property.images?.length ? (
											property.images.map((image, index) => {
												const imageUrl = image?.url || image;
												return (
													<a
														key={`${imageUrl}-${index}`}
														href={imageUrl}
														target="_blank"
														rel="noreferrer"
														className="group overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
													>
														<img
															src={imageUrl}
															alt={`Property ${index + 1}`}
															className="h-28 w-full object-cover"
														/>
													</a>
												);
											})
										) : (
											<p className="text-sm text-slate-500 dark:text-slate-400">No images uploaded yet.</p>
										)}
									</div>
								</div>

								<form onSubmit={handleImageUpload} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
									<h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
										Upload image
									</h3>
									<div className="mt-4 space-y-4">
										<label className="block">
											<span className="mb-2 block text-sm font-medium text-slate-600 dark:text-slate-400">
												Image file
											</span>
											<input
												type="file"
												accept="image/*"
												onChange={(event) => setImageFile(event.target.files?.[0] || null)}
												className="w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50 px-4 py-3 text-sm text-slate-950 dark:text-white dark:text-white outline-none transition file:mr-4 file:rounded-xl file:border-0 file:bg-slate-950 dark:bg-slate-700 dark:file:bg-slate-700 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white focus:border-slate-400"
											/>
										</label>

										<button
											type="submit"
											disabled={uploading}
											className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 dark:bg-slate-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
										>
											{uploading ? "Uploading..." : "Upload Image"}
										</button>
									</div>
									{uploadMessage ? (
										<div className="mt-4 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 p-4 text-sm text-emerald-700 dark:text-emerald-400">
											{uploadMessage}
										</div>
									) : null}
									{uploadError ? (
										<div className="mt-4 rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20 p-4 text-sm text-rose-700 dark:text-rose-400">
											{uploadError}
										</div>
									) : null}
								</form>
							</div>
						</section>
					</div>
				:	null}
			</div>
		</section>
	);
};

export default PropertyDetail;

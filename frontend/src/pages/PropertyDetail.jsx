import { useEffect, useState } from "react";
import { ArrowLeft, Image, Save } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { getPropertyById, updateProperty, uploadPropertyImage } from "../api/propertyApi";

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
	const [formData, setFormData] = useState({
		title: "",
		propertyType: "flat",
		status: "available",
		location: { city: "", locality: "", sector: "", pincode: "" },
		pricing: { askingPrice: "" },
	});

	const loadProperty = async ({ setBusy = false, mountedCheck = () => true } = {}) => {
		if (setBusy) setLoading(true);
		setError("");

		try {
			const response = await getPropertyById(id);
			if (!mountedCheck()) return;

			const currentProperty = response.data;
			setProperty(currentProperty);
			setFormData({
				title: currentProperty.title || "",
				propertyType: currentProperty.propertyType || "flat",
				status: currentProperty.status || "available",
				location: {
					city: currentProperty.location?.city || "",
					locality: currentProperty.location?.locality || "",
					sector: currentProperty.location?.sector || "",
					pincode: currentProperty.location?.pincode || "",
				},
				pricing: { askingPrice: currentProperty.pricing?.askingPrice ?? "" },
			});
		} catch (err) {
			if (!mountedCheck()) return;
			setError(err.response?.data?.message || "Failed to load property.");
		} finally {
			if (mountedCheck() && setBusy) setLoading(false);
		}
	};

	useEffect(() => {
		let isMounted = true;

		loadProperty({ setBusy: true, mountedCheck: () => isMounted });

		return () => {
			isMounted = false;
		};
	}, [id]);

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
		setSaving(true);
		setError("");
		setNotice("");

		try {
			const payload = {
				title: formData.title,
				propertyType: formData.propertyType,
				status: formData.status,
				location: formData.location,
				pricing: {
					askingPrice:
						formData.pricing.askingPrice === "" ?
							""
						:	Number(formData.pricing.askingPrice),
				},
			};

			const response = await updateProperty(id, payload);
			const updatedProperty = response.data.updated || property;
			setProperty((current) =>
				updatedProperty ? { ...current, ...updatedProperty } : current,
			);

			if (response.data.pending) {
				setNotice("Sensitive changes submitted for approval.");
			}
		} catch (err) {
			setError(err.response?.data?.message || "Unable to save property.");
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
			setUploadError(err.message || err.response?.data?.message || "Unable to upload image.");
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
					className="inline-flex w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
				>
					<ArrowLeft size={18} />
					Back to Properties
				</button>

				{loading ?
					<div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
						Loading property details...
					</div>
				: error ?
					<div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700 shadow-sm">
						{error}
					</div>
				: property ?
					<div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
						<article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
							<p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
								Property profile
							</p>
							<h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
								{property.title}
							</h1>
							<p className="mt-2 text-sm text-slate-500">
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
										className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
									>
										<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
											{label}
										</p>
										<p className="mt-2 text-sm font-medium text-slate-950">
											{value || "Not specified"}
										</p>
									</div>
								))}
							</div>
						</article>

						<aside className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
							<h2 className="text-xl font-semibold text-slate-950">
								Edit property
							</h2>
							<p className="mt-2 text-sm leading-6 text-slate-600">
								Use this form to update the main property details and keep the
								inventory current.
							</p>

							<form className="mt-6 space-y-4" onSubmit={handleSubmit}>
								<label className="block">
									<span className="mb-2 block text-sm font-medium text-slate-600">
										Title
									</span>
									<input
										type="text"
										name="title"
										value={formData.title}
										onChange={handleChange}
										className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
										required
									/>
								</label>

								<label className="block">
									<span className="mb-2 block text-sm font-medium text-slate-600">
										Property Type
									</span>
									<input
										type="text"
										name="propertyType"
										value={formData.propertyType}
										onChange={handleChange}
										className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
									/>
								</label>

								<label className="block">
									<span className="mb-2 block text-sm font-medium text-slate-600">
										Status
									</span>
									<input
										type="text"
										name="status"
										value={formData.status}
										onChange={handleChange}
										className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
									/>
								</label>

								<label className="block">
									<span className="mb-2 block text-sm font-medium text-slate-600">
										Asking Price
									</span>
									<input
										type="number"
										name="pricing.askingPrice"
										value={formData.pricing.askingPrice}
										onChange={handleChange}
										className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
									/>
								</label>

								<label className="block">
									<span className="mb-2 block text-sm font-medium text-slate-600">
										City
									</span>
									<input
										type="text"
										name="location.city"
										value={formData.location.city}
										onChange={handleChange}
										className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
									/>
								</label>

								<label className="block">
									<span className="mb-2 block text-sm font-medium text-slate-600">
										Locality
									</span>
									<input
										type="text"
										name="location.locality"
										value={formData.location.locality}
										onChange={handleChange}
										className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
									/>
								</label>

								<label className="block">
									<span className="mb-2 block text-sm font-medium text-slate-600">
										Sector
									</span>
									<input
										type="text"
										name="location.sector"
										value={formData.location.sector}
										onChange={handleChange}
										className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
									/>
								</label>

								<label className="block">
									<span className="mb-2 block text-sm font-medium text-slate-600">
										Pincode
									</span>
									<input
										type="text"
										name="location.pincode"
										value={formData.location.pincode}
										onChange={handleChange}
										className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
									/>
								</label>

								<button
									type="submit"
									disabled={saving}
									className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
								>
									<Save size={18} />
									{saving ? "Saving..." : "Save Changes"}
								</button>
							</form>

							{notice ?
								<div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
									{notice}
								</div>
							:	null}
						</aside>

						<section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8 xl:col-span-2">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div>
									<p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
										Images
									</p>
									<h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
										Property images
									</h2>
								</div>
								<div className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
									<Image size={16} />
									{property.images?.length || 0} images
								</div>
							</div>

							<div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
								<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
									<h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
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
														className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
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
											<p className="text-sm text-slate-500">No images uploaded yet.</p>
										)}
									</div>
								</div>

								<form onSubmit={handleImageUpload} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
									<h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
										Upload image
									</h3>
									<div className="mt-4 space-y-4">
										<label className="block">
											<span className="mb-2 block text-sm font-medium text-slate-600">
												Image file
											</span>
											<input
												type="file"
												accept="image/*"
												onChange={(event) => setImageFile(event.target.files?.[0] || null)}
												className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition file:mr-4 file:rounded-xl file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white focus:border-slate-400"
											/>
										</label>

										<button
											type="submit"
											disabled={uploading}
											className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
										>
											{uploading ? "Uploading..." : "Upload Image"}
										</button>
									</div>
									{uploadMessage ? (
										<div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
											{uploadMessage}
										</div>
									) : null}
									{uploadError ? (
										<div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
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

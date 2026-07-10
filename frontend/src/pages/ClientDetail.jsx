import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BadgeAlert, FileText, Save } from "lucide-react";
import { getClientById, updateClient, uploadClientDocument } from "../api/clientApi";

const safeLabel = (value) => String(value ?? "").replace(/_/g, " ");

const ClientDetail = () => {
	const { id } = useParams();
	const navigate = useNavigate();
	const [client, setClient] = useState(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [saving, setSaving] = useState(false);
	const [pendingApproval, setPendingApproval] = useState(null);
	const [uploading, setUploading] = useState(false);
	const [uploadMessage, setUploadMessage] = useState("");
	const [uploadError, setUploadError] = useState("");
	const [documentFormData, setDocumentFormData] = useState({
		file: null,
		type: "other",
	});
	const [formData, setFormData] = useState({
		phone: "",
		email: "",
		notes: "",
		pipelineStage: "",
		requirements: {
			city: "",
			locality: "",
			minBudget: "",
			maxBudget: "",
			minArea: "",
			maxArea: "",
			bedrooms: "",
		},
	});

	const loadClient = async ({ setBusy = false, mountedCheck = () => true } = {}) => {
		if (setBusy) setLoading(true);
		setError("");

		try {
			const response = await getClientById(id);
			if (!mountedCheck()) return;

			const currentClient = response.data;
			setClient(currentClient);
			setFormData({
				phone: currentClient.phone || "",
				email: currentClient.email || "",
				notes: currentClient.notes || "",
				pipelineStage: currentClient.pipelineStage || "",
				requirements: {
					city: currentClient.requirements?.city || "",
					locality: currentClient.requirements?.locality || "",
					minBudget: currentClient.requirements?.minBudget ?? "",
					maxBudget: currentClient.requirements?.maxBudget ?? "",
					minArea: currentClient.requirements?.minArea ?? "",
					maxArea: currentClient.requirements?.maxArea ?? "",
					bedrooms: currentClient.requirements?.bedrooms ?? "",
				},
			});
		} catch (err) {
			if (!mountedCheck()) return;
			setError(err.response?.data?.message || "Failed to load client.");
		} finally {
			if (mountedCheck() && setBusy) setLoading(false);
		}
	};

	useEffect(() => {
		let isMounted = true;

		loadClient({ setBusy: true, mountedCheck: () => isMounted });

		return () => {
			isMounted = false;
		};
	}, [id]);

	const handleChange = (event) => {
		const { name, value } = event.target;
		if (name.startsWith("requirements.")) {
			const key = name.split(".")[1];
			setFormData((current) => ({
				...current,
				requirements: {
					...current.requirements,
					[key]: value,
				},
			}));
			return;
		}

		setFormData((current) => ({ ...current, [name]: value }));
	};

	const handleSubmit = async (event) => {
		event.preventDefault();
		setSaving(true);
		setError("");

		const payload = {
			phone: formData.phone,
			email: formData.email,
			notes: formData.notes,
			pipelineStage: formData.pipelineStage,
			requirements: {
				city: formData.requirements.city,
				locality: formData.requirements.locality,
				minBudget:
					formData.requirements.minBudget === "" ?
						""
					:	Number(formData.requirements.minBudget),
				maxBudget:
					formData.requirements.maxBudget === "" ?
						""
					:	Number(formData.requirements.maxBudget),
				minArea:
					formData.requirements.minArea === "" ?
						""
					:	Number(formData.requirements.minArea),
				maxArea:
					formData.requirements.maxArea === "" ?
						""
					:	Number(formData.requirements.maxArea),
				bedrooms:
					formData.requirements.bedrooms === "" ?
						""
					:	Number(formData.requirements.bedrooms),
			},
		};

		try {
			const response = await updateClient(id, payload);
			const updatedClient = response.data.updated || client;
			setClient((current) =>
				updatedClient ? { ...current, ...updatedClient } : current,
			);

			if (response.data.pending) {
				setPendingApproval(response.data.pending);
			}
		} catch (err) {
			setError(err.response?.data?.message || "Unable to update client.");
		} finally {
			setSaving(false);
		}
	};

	const handleDocumentUpload = async (event) => {
		event.preventDefault();
		setUploading(true);
		setUploadError("");
		setUploadMessage("");

		try {
			if (!documentFormData.file) {
				throw new Error("Please choose a file to upload.");
			}

			const formData = new FormData();
			formData.append("file", documentFormData.file);
			formData.append("type", documentFormData.type);

			await uploadClientDocument(id, formData);
			setDocumentFormData({ file: null, type: "other" });
			setUploadMessage("Document uploaded successfully.");
			await loadClient({ setBusy: false });
		} catch (err) {
			setUploadError(err.message || err.response?.data?.message || "Unable to upload document.");
		} finally {
			setUploading(false);
		}
	};

	const directFieldBadgeVisible = Boolean(pendingApproval);

	return (
		<section className="p-6 sm:p-8">
			<div className="flex flex-col gap-6">
				<button
					type="button"
					onClick={() => navigate("/clients")}
					className="inline-flex w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
				>
					<ArrowLeft size={18} />
					Back to Clients
				</button>

				{loading ?
					<div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
						Loading client details...
					</div>
				: error ?
					<div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-8 text-sm text-rose-700 shadow-sm">
						{error}
					</div>
				: client ?
					<div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
						<article className="space-y-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
							<div className="flex flex-wrap items-start justify-between gap-4">
								<div>
									<p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
										Client profile
									</p>
									<h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
										{client.name}
									</h1>
									<p className="mt-2 text-sm text-slate-500">
										{client.clientCode}
									</p>
								</div>
								<div className="flex flex-wrap gap-2">
									<span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-slate-700">
										{safeLabel(client.pipelineStage)}
									</span>
									{directFieldBadgeVisible ?
										<span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
											<BadgeAlert size={14} />
											Pending Approval
										</span>
									:	null}
								</div>
							</div>

							<div className="grid gap-4 sm:grid-cols-2">
								{[
									["Phone", client.phone],
									["Email", client.email || "Not provided"],
									[
										"Assigned Broker",
										client.assignedBroker?.name || "Unassigned",
									],
									["City", client.requirements?.city || "Not provided"],
								].map(([label, value]) => (
									<div
										key={label}
										className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
									>
										<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
											{label}
										</p>
										<p className="mt-2 text-sm font-medium text-slate-950">
											{value}
										</p>
									</div>
								))}
							</div>

							<div>
								<h2 className="text-lg font-semibold text-slate-950">
									Requirements
								</h2>
								<div className="mt-4 grid gap-4 sm:grid-cols-2">
									{[
										["Property Type", client.requirements?.propertyType],
										["Locality", client.requirements?.locality],
										["Min Budget", client.requirements?.minBudget],
										["Max Budget", client.requirements?.maxBudget],
										["Min Area", client.requirements?.minArea],
										["Max Area", client.requirements?.maxArea],
										["Bedrooms", client.requirements?.bedrooms],
									].map(([label, value]) => (
										<div
											key={label}
											className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
										>
											<p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
												{label}
											</p>
											<p className="mt-2 text-sm font-medium text-slate-950">
												{value ?? "Not specified"}
											</p>
										</div>
									))}
								</div>
							</div>

							<div>
								<h2 className="text-lg font-semibold text-slate-950">Notes</h2>
								<p className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700">
									{client.notes || "No notes available."}
								</p>
							</div>

							{pendingApproval ?
								<div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
									<p className="font-semibold">
										Pending approval request submitted.
									</p>
									<p className="mt-1">
										Sensitive field edits are waiting for admin review.
									</p>
								</div>
							:	null}
						</article>

						<aside className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
							<h2 className="text-xl font-semibold text-slate-950">
								Edit client
							</h2>
							<p className="mt-2 text-sm leading-6 text-slate-600">
								Direct fields save immediately. Sensitive fields will be routed
								into a change request.
							</p>

							<form className="mt-6 space-y-4" onSubmit={handleSubmit}>
								{[
									["phone", "Phone"],
									["email", "Email"],
									["notes", "Notes"],
									["pipelineStage", "Pipeline Stage"],
									["requirements.city", "Requirement City"],
									["requirements.locality", "Requirement Locality"],
									["requirements.minBudget", "Min Budget"],
									["requirements.maxBudget", "Max Budget"],
									["requirements.minArea", "Min Area"],
									["requirements.maxArea", "Max Area"],
									["requirements.bedrooms", "Bedrooms"],
								].map(([name, label]) => (
									<label key={name} className="block">
										<span className="mb-2 block text-sm font-medium text-slate-600">
											{label}
										</span>
										<input
											type="text"
											name={name}
											value={
												name.startsWith("requirements.") ?
													formData.requirements[name.split(".")[1]]
												:	formData[name]
											}
											onChange={handleChange}
											className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-slate-400"
										/>
									</label>
								))}

								<button
									type="submit"
									disabled={saving}
									className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
								>
									<Save size={18} />
									{saving ? "Saving..." : "Save Changes"}
								</button>
							</form>

							{pendingApproval ?
								<div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
									Pending Approval
								</div>
							:	null}
						</aside>

						<section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8 xl:col-span-2">
							<div className="flex flex-wrap items-center justify-between gap-3">
								<div>
									<p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
										Documents
									</p>
									<h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
										Uploaded files
									</h2>
								</div>
								<div className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
									<FileText size={16} />
									{client.documents?.length || 0} files
								</div>
							</div>

							<div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
								<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
									<h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
										Existing documents
									</h3>
									<div className="mt-4 space-y-3">
										{client.documents?.length ? (
											client.documents.map((document, index) => (
												<div
													key={`${document.name}-${index}`}
													className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
												>
													<div className="flex flex-wrap items-center justify-between gap-3">
														<div>
															<p className="font-medium text-slate-950">{document.name}</p>
															<p className="mt-1 text-sm text-slate-500">
																{document.type || "other"} · {document.uploadedAt ? new Date(document.uploadedAt).toLocaleDateString("en-IN") : "Unknown date"}
															</p>
														</div>
														<a
															href={document.url}
															target="_blank"
															rel="noreferrer"
															className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
														>
															Open
														</a>
													</div>
												</div>
										))
										) : (
											<p className="text-sm text-slate-500">No documents uploaded yet.</p>
										)}
									</div>
								</div>

								<form onSubmit={handleDocumentUpload} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
									<h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
										Upload document
									</h3>
									<div className="mt-4 space-y-4">
										<label className="block">
											<span className="mb-2 block text-sm font-medium text-slate-600">
												File
											</span>
											<input
												type="file"
												accept=".pdf,image/*"
												onChange={(event) =>
													setDocumentFormData((current) => ({
														...current,
														file: event.target.files?.[0] || null,
													}))
												}
												className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition file:mr-4 file:rounded-xl file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white focus:border-slate-400"
											/>
										</label>

										<label className="block">
											<span className="mb-2 block text-sm font-medium text-slate-600">
												Type
											</span>
											<select
												value={documentFormData.type}
												onChange={(event) =>
													setDocumentFormData((current) => ({
														...current,
														type: event.target.value,
													}))
												}
												className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-slate-400"
											>
												{["id_proof", "income_proof", "agreement", "other"].map((option) => (
													<option key={option} value={option}>
														{option.replace(/_/g, " ")}
													</option>
												))}
											</select>
										</label>

										<button
											type="submit"
											disabled={uploading}
											className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
										>
											{uploading ? "Uploading..." : "Upload Document"}
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

export default ClientDetail;

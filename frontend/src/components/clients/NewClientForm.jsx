import { useState } from "react";

const EMPTY = {
	name: "",
	phone: "",
	email: "",
	city: "",
	locality: "",
	propertyType: "",
	minBudgetLakh: "",
	maxBudgetLakh: "",
	bedrooms: "",
	notes: "",
};

const input =
	"w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-slate-400 dark:border-slate-700 dark:bg-slate-700 dark:text-white";

const Field = ({ label, hint, children }) => (
	<label className="block">
		<span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
			{label}
			{hint ? <span className="ml-1 text-xs font-normal text-slate-400">{hint}</span> : null}
		</span>
		{children}
	</label>
);

const lakhs = (value) => (value === "" ? undefined : Math.round(Number(value) * 100000));

// Contact details plus what the buyer is looking for, so matching works from day one.
const NewClientForm = ({ onSubmit, onCancel, submitting }) => {
	const [form, setForm] = useState(EMPTY);
	const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

	const submit = (event) => {
		event.preventDefault();
		const requirements = {
			city: form.city || undefined,
			locality: form.locality || undefined,
			propertyType: form.propertyType || undefined,
			minBudget: lakhs(form.minBudgetLakh),
			maxBudget: lakhs(form.maxBudgetLakh),
			bedrooms: form.bedrooms === "" ? undefined : Number(form.bedrooms),
		};
		onSubmit(
			{
				name: form.name,
				phone: form.phone,
				email: form.email || undefined,
				notes: form.notes || undefined,
				requirements: Object.values(requirements).some((v) => v !== undefined) ? requirements : undefined,
			},
			() => setForm(EMPTY),
		);
	};

	return (
		<form onSubmit={submit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
			<h2 className="text-lg font-semibold text-slate-900 dark:text-white">New client</h2>
			<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<Field label="Name">
					<input className={input} value={form.name} onChange={set("name")} required autoComplete="off" />
				</Field>
				<Field label="Phone" hint="10-digit mobile">
					<input className={input} value={form.phone} onChange={set("phone")} required inputMode="tel" placeholder="98765 43210" />
				</Field>
				<Field label="Email">
					<input className={input} type="email" value={form.email} onChange={set("email")} />
				</Field>
			</div>

			<p className="mt-6 text-sm font-semibold text-slate-700 dark:text-slate-200">Looking for</p>
			<div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<Field label="City">
					<input className={input} value={form.city} onChange={set("city")} placeholder="Pune" />
				</Field>
				<Field label="Locality">
					<input className={input} value={form.locality} onChange={set("locality")} placeholder="Baner" />
				</Field>
				<Field label="Type">
					<select className={input} value={form.propertyType} onChange={set("propertyType")}>
						<option value="">Any</option>
						{["flat", "villa", "plot", "commercial"].map((t) => (
							<option key={t} value={t}>
								{t}
							</option>
						))}
					</select>
				</Field>
				<Field label="Budget from" hint="₹ lakh">
					<input className={input} type="number" min="0" step="0.5" value={form.minBudgetLakh} onChange={set("minBudgetLakh")} placeholder="80" />
				</Field>
				<Field label="Budget up to" hint="₹ lakh">
					<input className={input} type="number" min="0" step="0.5" value={form.maxBudgetLakh} onChange={set("maxBudgetLakh")} placeholder="100" />
				</Field>
				<Field label="Bedrooms">
					<input className={input} type="number" min="0" max="20" value={form.bedrooms} onChange={set("bedrooms")} placeholder="2" />
				</Field>
			</div>
			<div className="mt-4">
				<Field label="Notes">
					<textarea className={input} rows={2} value={form.notes} onChange={set("notes")} />
				</Field>
			</div>

			<div className="mt-6 flex justify-end gap-3">
				<button
					type="button"
					onClick={onCancel}
					className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-300"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={submitting}
					className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-950"
				>
					{submitting ? "Creating..." : "Create client"}
				</button>
			</div>
		</form>
	);
};

export default NewClientForm;

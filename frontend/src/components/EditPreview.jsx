import { fieldLabel } from "../utils/format";

// Before saving: which of the changed fields apply now and which wait for an admin.
const EditPreview = ({ preview }) => {
	if (!preview.direct.length && !preview.approval.length) return null;
	return (
		<div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-700/40">
			{preview.direct.length ?
				<p className="text-slate-700 dark:text-slate-200">
					<span className="font-semibold">Saves now:</span> {preview.direct.map(fieldLabel).join(", ")}
				</p>
			:	null}
			{preview.approval.length ?
				<p className="text-amber-800 dark:text-amber-300">
					<span className="font-semibold">Sent for approval:</span> {preview.approval.map(fieldLabel).join(", ")}
				</p>
			:	null}
		</div>
	);
};

export default EditPreview;

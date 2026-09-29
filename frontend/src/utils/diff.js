// Changed-fields-only edits: compare the form with what was loaded and send just
// the difference, so an untouched sensitive field can never create a change
// request by accident (and the server's diff has less to throw away).

// { requirements: { city: "Pune" } } → { "requirements.city": "Pune" }
export const flatten = (object, prefix = "") =>
	Object.entries(object).reduce((out, [key, value]) => {
		const path = prefix ? `${prefix}.${key}` : key;
		if (value && typeof value === "object" && !Array.isArray(value)) Object.assign(out, flatten(value, path));
		else out[path] = value;
		return out;
	}, {});

const normalise = (value) => (value === null || value === undefined ? "" : String(value).trim());

export const changedPaths = (initial, current) => {
	const before = flatten(initial);
	const after = flatten(current);
	return Object.keys(after).filter((path) => normalise(before[path]) !== normalise(after[path]));
};

// Builds the nested PATCH body from flat paths. Numeric fields are sent as
// numbers; an emptied field is sent as "" (the API treats it as "clear").
export const buildPatch = (paths, current, numericFields = new Set()) => {
	const flat = flatten(current);
	const patch = {};
	for (const path of paths) {
		const raw = flat[path];
		const value = numericFields.has(path) && raw !== "" && raw !== null ? Number(raw) : raw;
		const keys = path.split(".");
		let node = patch;
		keys.slice(0, -1).forEach((key) => {
			node[key] = node[key] || {};
			node = node[key];
		});
		node[keys[keys.length - 1]] = value;
	}
	return patch;
};

// Splits changed fields into "saves now" and "needs approval" for a preview.
export const classifyChanges = (paths, policy, appliesDirectly) => {
	if (!policy || appliesDirectly) return { direct: paths, approval: [] };
	return {
		direct: paths.filter((path) => !policy.approval.includes(path)),
		approval: paths.filter((path) => policy.approval.includes(path)),
	};
};

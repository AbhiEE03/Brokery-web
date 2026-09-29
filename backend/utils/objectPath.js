const mongoose = require("mongoose");

/** { a: { b: 1 }, c: 2 } → [["a.b", 1], ["c", 2]] (arrays are treated as leaf values). */
const flattenPayload = (value, prefix = "") => {
	const entries = [];

	if (value && typeof value === "object" && !Array.isArray(value)) {
		for (const [key, childValue] of Object.entries(value)) {
			const nextKey = prefix ? `${prefix}.${key}` : key;

			if (
				childValue &&
				typeof childValue === "object" &&
				!Array.isArray(childValue) &&
				!(childValue instanceof Date) &&
				!mongoose.isObjectIdOrHexString(childValue)
			) {
				entries.push(...flattenPayload(childValue, nextKey));
			} else {
				entries.push([nextKey, childValue]);
			}
		}
	}

	return entries;
};

const getValueByPath = (source, path) =>
	path.split(".").reduce((current, key) => current?.[key], source);

/** "" / null / undefined all mean "no value". */
const normalizeValue = (value) => {
	if (value === undefined || value === null || value === "") return null;
	if (value instanceof mongoose.Types.ObjectId) return value.toString();
	if (value?._id instanceof mongoose.Types.ObjectId) return value._id.toString();
	if (value instanceof Date) return value.toISOString();
	return value;
};

const valuesEqual = (a, b) => {
	const left = normalizeValue(a);
	const right = normalizeValue(b);
	if (typeof left === "object" || typeof right === "object") {
		return JSON.stringify(left) === JSON.stringify(right);
	}
	return left === right;
};

module.exports = { flattenPayload, getValueByPath, normalizeValue, valuesEqual };

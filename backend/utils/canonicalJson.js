/**
 * Deterministic JSON for hashing: object keys sorted, ObjectIds as hex strings,
 * Dates as ISO strings, undefined dropped. The same logical record always
 * serialises to the same bytes, before and after a round trip through MongoDB.
 */
const normalize = (value) => {
	if (value === null || value === undefined) return null;
	if (value instanceof Date) return value.toISOString();
	if (typeof value === "object" && value._bsontype === "ObjectId") return value.toHexString();
	if (typeof value === "object" && typeof value.toHexString === "function") return value.toHexString();
	if (Array.isArray(value)) return value.map(normalize);
	if (typeof value === "object") {
		const out = {};
		for (const key of Object.keys(value).sort()) {
			if (value[key] !== undefined) out[key] = normalize(value[key]);
		}
		return out;
	}
	return value;
};

const canonicalJson = (value) => JSON.stringify(normalize(value));

module.exports = { canonicalJson, normalize };

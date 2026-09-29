/**
 * Indian mobile numbers → one canonical key, "+91XXXXXXXXXX", so the same
 * person entered as "098765 43210", "+91-98765-43210" or "919876543210"
 * is recognised as one client.
 *
 * Accepted: optional +91 / 91 / 0 prefix, then 10 digits starting with 6–9.
 * Spaces, dashes, dots and brackets are ignored. Anything else → null.
 */
const normalizeIndianMobile = (input) => {
	if (typeof input !== "string" && typeof input !== "number") return null;
	const raw = String(input).trim();
	if (!/^\+?[\d\s\-().]+$/.test(raw)) return null;

	let digits = raw.replace(/\D/g, "");
	if (raw.startsWith("+")) {
		if (!digits.startsWith("91")) return null; // other country codes
		digits = digits.slice(2);
	} else if (digits.length === 12 && digits.startsWith("91")) {
		digits = digits.slice(2);
	} else if (digits.length === 11 && digits.startsWith("0")) {
		digits = digits.slice(1);
	}

	return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
};

const INVALID_MOBILE_MESSAGE = "Enter a valid Indian mobile number (10 digits starting with 6–9)";

module.exports = { normalizeIndianMobile, INVALID_MOBILE_MESSAGE };

// ₹85 L, ₹1.45 Cr, ₹75,000 — how brokers say prices (used in match explanations).
const trim = (n) => Number(n.toFixed(2)).toString();

const formatINR = (value) => {
	const amount = Number(value);
	if (value === null || value === undefined || Number.isNaN(amount)) return "—";
	if (Math.abs(amount) >= 1e7) return `₹${trim(amount / 1e7)} Cr`;
	if (Math.abs(amount) >= 1e5) return `₹${trim(amount / 1e5)} L`;
	return `₹${Math.round(amount).toLocaleString("en-IN")}`;
};

module.exports = { formatINR };

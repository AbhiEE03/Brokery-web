// Shared display formatting.

// ₹85 L, ₹1.45 Cr, ₹75,000 — how brokers talk about prices.
export const formatINR = (value) => {
	const amount = Number(value);
	if (value === null || value === undefined || value === "" || Number.isNaN(amount)) return "—";
	if (Math.abs(amount) >= 1e7) return `₹${trim(amount / 1e7)} Cr`;
	if (Math.abs(amount) >= 1e5) return `₹${trim(amount / 1e5)} L`;
	return amount.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
};

const trim = (n) => Number(n.toFixed(2)).toString();

export const formatDateTime = (value) =>
	value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

export const formatDate = (value) => (value ? new Date(value).toLocaleDateString("en-IN", { dateStyle: "medium" }) : "—");

export const FIELD_LABELS = {
	name: "Name",
	phone: "Phone",
	email: "Email",
	notes: "Notes",
	pipelineStage: "Pipeline stage",
	assignedBroker: "Assigned broker",
	"requirements.city": "City",
	"requirements.locality": "Locality",
	"requirements.minBudget": "Min budget",
	"requirements.maxBudget": "Max budget",
	"requirements.minArea": "Min area (sq ft)",
	"requirements.maxArea": "Max area (sq ft)",
	"requirements.bedrooms": "Bedrooms",
	"requirements.propertyType": "Property type",
	title: "Title",
	propertyType: "Property type",
	status: "Listing status",
	"location.city": "City",
	"location.locality": "Locality",
	"location.sector": "Sector",
	"location.pincode": "Pincode",
	"pricing.askingPrice": "Asking price",
	"pricing.pricePerSqft": "Price per sq ft",
	"specs.area": "Area (sq ft)",
	"specs.bedrooms": "Bedrooms",
	"specs.bathrooms": "Bathrooms",
	"specs.floor": "Floor",
	"specs.totalFloors": "Total floors",
	"specs.parking": "Parking",
	"specs.furnished": "Furnishing",
};

export const fieldLabel = (field) => FIELD_LABELS[field] || field.split(".").pop().replace(/([A-Z])/g, " $1").toLowerCase();

const isMoneyField = (field = "") => /budget|price/i.test(field) && !/sqft/i.test(field);

export const formatFieldValue = (field, value) => {
	if (value === null || value === undefined || value === "") return "—";
	if (isMoneyField(field)) return formatINR(value);
	if (typeof value === "boolean") return value ? "Yes" : "No";
	if (typeof value === "object") return JSON.stringify(value);
	return String(value).replace(/_/g, " ");
};

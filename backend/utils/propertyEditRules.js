// Low-risk property details that can be updated directly by a broker.
// These fields are mostly descriptive or operational and do not materially change the listing’s commercial value.
const DIRECT_EDIT_FIELDS = [
	"title", // Listing title is a descriptive field and can be adjusted directly.
	"dealer.name", // Dealer name is contact metadata and is low risk.
	"dealer.phone", // Dealer phone is contact metadata and is low risk.
	"dealer.email", // Dealer email is contact metadata and is low risk.
	"specs.parking", // Parking availability is a feature detail; low business impact.
	"specs.furnished", // Furnishing status is a feature detail; low business impact.
	"location.locality", // Locality change is a minor listing detail compared with city or price.
];

// High-impact property fields that affect listing status, pricing, or market positioning.
// These require admin approval before being applied.
const APPROVAL_REQUIRED_FIELDS = [
	"status", // Changes the property lifecycle state (available, sold, etc.).
	"pricing.askingPrice", // Directly affects listing value and revenue expectations.
	"pricing.pricePerSqft", // Directly affects valuation and market positioning.
	"location.city", // Changes the core market location of the listing.
	"specs.area", // Alters the property size, which materially changes value.
	"specs.bedrooms", // Changes a key buyer-relevant feature and market fit.
];

module.exports = {
	DIRECT_EDIT_FIELDS,
	APPROVAL_REQUIRED_FIELDS,
};

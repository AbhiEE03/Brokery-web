// Low-risk client profile details that a broker can update without admin approval.
// These fields are mostly informational or do not materially change deal status.
const DIRECT_EDIT_FIELDS = [
	"notes", // Informational notes; low business risk.
	"email", // Contact detail update; usually safe and non-sensitive.
	"phone", // Contact detail update; usually safe and non-sensitive.
	"requirements.locality", // Locality preference is a minor preference adjustment.
	"requirements.propertyType", // Property type preference is a minor preference adjustment.
	"requirements.bedrooms", // Bedroom preference is a minor preference adjustment.
];

// Sensitive client fields that can affect pipeline management and deal strategy.
// These should require admin review before being applied.
const APPROVAL_REQUIRED_FIELDS = [
	"pipelineStage", // Changes the client’s deal progress and sales workflow.
	"assignedBroker", // Changes ownership and responsibility for the client.
	"requirements.minBudget", // Impacts deal qualification and financial targeting.
	"requirements.maxBudget", // Impacts deal qualification and financial targeting.
	"requirements.city", // Changes the core search geography for the client.
	"requirements.minArea", // Alters property suitability criteria materially.
	"requirements.maxArea", // Alters property suitability criteria materially.
];

module.exports = {
	DIRECT_EDIT_FIELDS,
	APPROVAL_REQUIRED_FIELDS,
};

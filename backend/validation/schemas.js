const { z } = require("zod");
const { MAX_LIMIT } = require("../utils/pagination");

const PIPELINE_STAGES = ["lead", "contacted", "site_visit", "negotiation", "closed", "lost"];
const PROPERTY_TYPES = ["flat", "villa", "plot", "commercial"];
const PROPERTY_STATUSES = ["available", "under_negotiation", "sold", "withdrawn"];
const FURNISHING = ["unfurnished", "semi-furnished", "fully-furnished"];
const INTEREST_LEVELS = ["high", "medium", "low"];

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

// Optional free-text: "" becomes undefined so it doesn't overwrite with blanks on create.
const optionalText = (max) =>
	z
		.string()
		.trim()
		.max(max)
		.optional()
		.transform((value) => (value === "" ? undefined : value));

// Values for PATCH bodies: "" or null explicitly clears a field.
const clearable = (schema) => z.union([schema, z.literal(""), z.null()]).optional();

const amount = z.number().finite().nonnegative();
// Form inputs may arrive as numeric strings; "" means "not provided".
const numericInput = z.preprocess(
	(value) =>
		value === "" || value === null ? undefined
		: typeof value === "string" ? Number(value)
		: value,
	amount.optional(),
);

const optionalEmail = z
	.union([z.email().max(254), z.literal("")])
	.optional()
	.transform((value) => (value === "" ? undefined : value?.toLowerCase()));

const rangeIsOrdered = (min, max) =>
	min === undefined || max === undefined || min === null || max === null || min === "" || max === "" || min <= max;

// ---------- query / params ----------

const pagination = {
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(MAX_LIMIT).default(20),
};

const search = z.string().trim().max(64).optional();

const idParams = z.object({ id: objectId });

// ---------- auth ----------

const loginBody = z.object({
	email: z.string().trim().toLowerCase().min(1).max(254),
	password: z.string().min(1).max(200),
});

const registerBody = z.object({
	name: z.string().trim().min(1).max(100),
	email: z.email().max(254).transform((value) => value.toLowerCase()),
	password: z.string().min(8).max(200),
	role: z.enum(["admin", "broker"]).optional(),
});

// ---------- clients ----------

const requirementsCreate = z
	.object({
		propertyType: z.enum(PROPERTY_TYPES).optional(),
		city: optionalText(80),
		locality: optionalText(120),
		minBudget: amount.optional(),
		maxBudget: amount.optional(),
		minArea: amount.optional(),
		maxArea: amount.optional(),
		bedrooms: z.number().int().min(0).max(20).optional(),
	})
	.refine((r) => rangeIsOrdered(r.minBudget, r.maxBudget), {
		message: "minBudget must not exceed maxBudget",
		path: ["minBudget"],
	})
	.refine((r) => rangeIsOrdered(r.minArea, r.maxArea), {
		message: "minArea must not exceed maxArea",
		path: ["minArea"],
	});

// pipelineStage, clientCode, documents and timestamps are server-controlled and stripped.
const createClientBody = z.object({
	name: z.string().trim().min(1).max(100),
	phone: z.string().trim().min(7).max(20),
	email: optionalEmail,
	notes: optionalText(2000),
	requirements: requirementsCreate.optional(),
	assignedBroker: objectId.optional(), // honoured for admins only
});

const updateClientBody = z.object({
	name: z.string().trim().min(1).max(100).optional(),
	phone: z.string().trim().min(7).max(20).optional(),
	email: clearable(z.email().max(254)),
	notes: clearable(z.string().max(2000)),
	pipelineStage: z.enum(PIPELINE_STAGES).optional(),
	assignedBroker: objectId.optional(),
	requirements: z
		.object({
			propertyType: clearable(z.enum(PROPERTY_TYPES)),
			city: clearable(z.string().trim().max(80)),
			locality: clearable(z.string().trim().max(120)),
			minBudget: clearable(amount),
			maxBudget: clearable(amount),
			minArea: clearable(amount),
			maxArea: clearable(amount),
			bedrooms: clearable(z.number().int().min(0).max(20)),
		})
		.optional(),
});

const listClientsQuery = z.object({
	...pagination,
	stage: z.enum(PIPELINE_STAGES).optional(),
	city: z.string().trim().max(80).optional(),
	broker: objectId.optional(),
	search,
});

// ---------- properties ----------

const locationSchema = z.object({
	city: z.string().trim().min(1).max(80),
	locality: optionalText(120),
	sector: optionalText(80),
	pincode: optionalText(10),
});

const specsSchema = z.object({
	area: amount.optional(),
	bedrooms: z.number().int().min(0).max(50).optional(),
	bathrooms: z.number().int().min(0).max(50).optional(),
	floor: z.number().int().min(-5).max(200).optional(),
	totalFloors: z.number().int().min(0).max(200).optional(),
	parking: z.boolean().optional(),
	furnished: z.enum(FURNISHING).optional(),
});

const dealerSchema = z.object({
	name: optionalText(100),
	phone: optionalText(20),
	email: optionalEmail,
});

// status is server-controlled at creation (always "available").
const createPropertyBody = z.object({
	title: z.string().trim().min(1).max(200),
	propertyType: z.enum(PROPERTY_TYPES).optional(),
	location: locationSchema,
	pricing: z
		.object({
			askingPrice: numericInput,
			pricePerSqft: numericInput,
		})
		.optional(),
	specs: specsSchema.optional(),
	dealer: dealerSchema.optional(),
});

const updatePropertyBody = z.object({
	title: z.string().trim().min(1).max(200).optional(),
	propertyType: z.enum(PROPERTY_TYPES).optional(),
	status: z.enum(PROPERTY_STATUSES).optional(),
	location: z
		.object({
			city: z.string().trim().min(1).max(80).optional(),
			locality: clearable(z.string().trim().max(120)),
			sector: clearable(z.string().trim().max(80)),
			pincode: clearable(z.string().trim().max(10)),
		})
		.optional(),
	pricing: z
		.object({
			askingPrice: clearable(amount),
			pricePerSqft: clearable(amount),
		})
		.optional(),
	specs: z
		.object({
			area: clearable(amount),
			bedrooms: clearable(z.number().int().min(0).max(50)),
			bathrooms: clearable(z.number().int().min(0).max(50)),
			floor: clearable(z.number().int().min(-5).max(200)),
			totalFloors: clearable(z.number().int().min(0).max(200)),
			parking: z.boolean().optional(),
			furnished: clearable(z.enum(FURNISHING)),
		})
		.optional(),
	dealer: z
		.object({
			name: clearable(z.string().trim().max(100)),
			phone: clearable(z.string().trim().max(20)),
			email: clearable(z.email().max(254)),
		})
		.optional(),
});

const listPropertiesQuery = z.object({
	...pagination,
	city: z.string().trim().max(80).optional(),
	type: z.enum(PROPERTY_TYPES).optional(),
	status: z.enum(PROPERTY_STATUSES).optional(),
	minPrice: z.coerce.number().nonnegative().optional(),
	maxPrice: z.coerce.number().nonnegative().optional(),
	minArea: z.coerce.number().nonnegative().optional(),
	search,
});

// ---------- matches ----------

const createMatchBody = z.object({
	client: objectId,
	property: objectId,
	interestLevel: z.enum(INTEREST_LEVELS),
	notes: optionalText(1000),
});

const updateMatchBody = z.object({
	interestLevel: z.enum(INTEREST_LEVELS).optional(),
	notes: z.string().trim().max(1000).optional(),
});

// ---------- change requests / activity ----------

const resolveChangeRequestBody = z.object({
	action: z.enum(["approved", "rejected"]),
	adminNote: z.string().trim().max(500).optional(),
});

const decisionBody = z.object({
	adminNote: z.string().trim().max(500).optional(),
});

const listChangeRequestsQuery = z
	.object({
		...pagination,
		status: z
			.enum(["pending", "approved", "rejected", "conflict", "superseded", "withdrawn"])
			.optional(),
		entityType: z.enum(["client", "property"]).optional(),
		from: z.coerce.date().optional(),
		to: z.coerce.date().optional(),
	})
	.transform((query) => {
		// A date-only "to" (YYYY-MM-DD) should include that whole day.
		if (query.to) query.to = new Date(query.to.getTime() + 24 * 60 * 60 * 1000 - 1);
		return query;
	});

// Date-only "to" values (YYYY-MM-DD) include that whole day.
const endOfDay = (date) => (date ? new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1) : date);

// Keyset cursor: the audit sequence number of the last item on the previous page.
const cursor = z.coerce.number().int().positive().optional();

const listActivityQuery = z
	.object({
		...pagination,
		cursor,
		entityType: z
			.enum(["client", "property", "match", "change_request", "user", "ownership_claim"])
			.optional(),
		action: z.string().regex(/^[a-z_]+\.[a-z_]+$/, "Invalid action").optional(),
		broker: objectId.optional(),
		from: z.coerce.date().optional(),
		to: z.coerce.date().optional(),
	})
	.transform((query) => ({ ...query, to: endOfDay(query.to) }));

const listMatchesQuery = z.object({
	...pagination,
	interestLevel: z.enum(INTEREST_LEVELS).optional(),
});
const entityParams = z.object({ entityId: objectId });

module.exports = {
	PIPELINE_STAGES,
	PROPERTY_TYPES,
	PROPERTY_STATUSES,
	objectId,
	pagination,
	idParams,
	loginBody,
	registerBody,
	createClientBody,
	updateClientBody,
	listClientsQuery,
	createPropertyBody,
	updatePropertyBody,
	listPropertiesQuery,
	createMatchBody,
	updateMatchBody,
	resolveChangeRequestBody,
	decisionBody,
	listChangeRequestsQuery,
	listActivityQuery,
	listMatchesQuery,
	entityParams,
};

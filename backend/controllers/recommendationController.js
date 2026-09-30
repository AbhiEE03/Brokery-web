const Property = require("../models/Property");
const RecommendationEvent = require("../models/RecommendationEvent");
const { HttpError } = require("../utils/httpError");
const { recommendProperties, interestedClients, scoreMatch } = require("../services/matchingService");
const { createMatch } = require("../services/matchService");
const audit = require("../services/auditService");

const PROPERTY_CARD = (p) => ({
	_id: p._id,
	propertyCode: p.propertyCode,
	title: p.title,
	propertyType: p.propertyType,
	status: p.status,
	location: p.location,
	pricing: p.pricing,
	specs: p.specs,
	image: p.images?.[0]?.url ?? null,
	createdAt: p.createdAt,
});

const CLIENT_CARD = (c) => ({
	_id: c._id,
	clientCode: c.clientCode,
	name: c.name,
	pipelineStage: c.pipelineStage,
	assignedBroker: c.assignedBroker,
	requirements: c.requirements,
});

// GET /api/clients/:id/recommendations?k=10
exports.getRecommendations = async (req, res) => {
	const client = req.resource;
	const { k } = req.validated.query;
	const { candidates, results } = await recommendProperties(client, { k });
	res.status(200).json({
		success: true,
		data: results.map(({ property, score, breakdown, rank }) => ({ rank, score, breakdown, property: PROPERTY_CARD(property) })),
		meta: {
			candidates,
			// Tell the UI why a list is empty rather than showing nothing.
			...(client.requirements?.cityKey ? {} : { hint: "Add a city to this client's requirements to get recommendations." }),
		},
	});
};

// GET /api/properties/:id/interested-clients?k=10
exports.getInterestedClients = async (req, res) => {
	const { k } = req.validated.query;
	const { candidates, results } = await interestedClients(req.resource, { user: req.user, k });
	res.status(200).json({
		success: true,
		data: results.map(({ client, score, breakdown, rank }) => ({ rank, score, breakdown, client: CLIENT_CARD(client) })),
		meta: { candidates },
	});
};

const loadAvailableProperty = async (propertyId) => {
	const property = await Property.findById(propertyId).lean();
	if (!property) throw new HttpError(404, "Property not found");
	return property;
};

// POST /api/clients/:id/recommendations/:propertyId/link { interestLevel, rank }
exports.linkRecommendation = async (req, res) => {
	const client = req.resource;
	const property = await loadAvailableProperty(req.validated.params.propertyId);
	const { score } = scoreMatch(client, property);
	const match = await createMatch({
		client,
		property,
		interestLevel: req.body.interestLevel,
		notes: req.body.notes,
		actor: req.user,
		recommendation: { rank: req.body.rank, score },
		via: "recommendation",
	});
	res.status(201).json({ success: true, message: "Match created", data: match });
};

// POST /api/clients/:id/recommendations/:propertyId/dismiss
exports.dismissRecommendation = async (req, res) => {
	const client = req.resource;
	const property = await loadAvailableProperty(req.validated.params.propertyId);
	const { score } = scoreMatch(client, property);
	const existing = await RecommendationEvent.findOneAndUpdate(
		{ client: client._id, property: property._id, action: "dismissed" },
		{ $setOnInsert: { broker: req.user._id, score, rank: req.body?.rank } },
		{ upsert: true, returnDocument: "before" },
	);
	if (!existing) {
		await audit.record({
			actor: req.user._id,
			action: "client.recommendation_dismissed",
			entityType: "client",
			entityId: client._id,
			summary: `Marked ${property.title} (${property.propertyCode}) as not a fit for ${client.name}`,
			after: { property: property._id, score },
		});
	}
	res.status(200).json({ success: true, message: "Hidden from this client's recommendations" });
};

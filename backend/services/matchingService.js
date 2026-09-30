/**
 * Explainable client ↔ property matching.
 *
 *   1. Candidates: one indexed query (same city, available, the client's
 *      property type if set, price ≤ max budget × 1.1), capped at 500.
 *   2. Scoring: a weighted sum of five features, each in [0, 1], with a
 *      human-readable reason per feature. O(n·f) for n candidates, f features.
 *   3. Top-k: a size-k heap, O(n log k), instead of sorting all candidates.
 *
 * The same scorer runs in the other direction (clients interested in a
 * property), which re-match alerts use when a property changes.
 */
const Client = require("../models/Client");
const Property = require("../models/Property");
const Match = require("../models/Match");
const RecommendationEvent = require("../models/RecommendationEvent");
const config = require("../config/matchingWeights");
const { topK } = require("../utils/topK");
const { formatINR } = require("../utils/money");
const { isAdmin } = require("../policies");

const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_STAGES = ["lead", "contacted", "site_visit", "negotiation"];
const round = (n) => Math.round(n * 1000) / 1000;
const clamp01 = (n) => Math.min(1, Math.max(0, n));
const isNum = (v) => typeof v === "number" && !Number.isNaN(v);
const norm = (s) => String(s || "").trim().toLowerCase();

// ---- features: each returns { value in [0,1], reason } -------------------

const budgetFit = (requirements, property) => {
	const price = property.pricing?.askingPrice;
	const { minBudget: min, maxBudget: max } = requirements;
	if (!isNum(price)) return { value: 0, reason: "No asking price listed" };
	if (!isNum(min) && !isNum(max)) return { value: 0.5, reason: `Price ${formatINR(price)} (client has no budget set)` };

	const low = isNum(min) ? min : 0;
	if (isNum(max) && price > max) {
		// Falls to 0 at the 10% stretch limit used for candidate retrieval.
		const over = (price - max) / max;
		return {
			value: clamp01(1 - over / (config.budgetStretch - 1)),
			reason: `Price ${formatINR(price)} is ${Math.round(over * 100)}% over the ${formatINR(max)} budget`,
		};
	}
	if (price < low) {
		// Well under budget is usually still interesting, just less so.
		const under = (low - price) / low;
		return {
			value: clamp01(1 - under / 0.5),
			reason: `Price ${formatINR(price)} is ${Math.round(under * 100)}% under the ${formatINR(low)} minimum`,
		};
	}
	const range = isNum(max) ? `${formatINR(low)}–${formatINR(max)}` : `from ${formatINR(low)}`;
	return { value: 1, reason: `Price ${formatINR(price)} within budget ${range}` };
};

const areaFit = (requirements, property) => {
	const area = property.specs?.area;
	const { minArea: min, maxArea: max } = requirements;
	if (!isNum(min) && !isNum(max)) return { value: 0.5, reason: "Client has no size preference" };
	if (!isNum(area)) return { value: 0.25, reason: "Area not listed" };
	if (isNum(min) && area < min) {
		return { value: clamp01(1 - (min - area) / (0.2 * min)), reason: `${area} sq ft, smaller than the ${min} sq ft wanted` };
	}
	if (isNum(max) && area > max) {
		return { value: clamp01(1 - (area - max) / (0.2 * max)), reason: `${area} sq ft, larger than the ${max} sq ft wanted` };
	}
	return { value: 1, reason: `${area} sq ft fits the size wanted` };
};

const localityFit = (requirements, property) => {
	const wanted = norm(requirements.locality);
	const actual = norm(property.location?.locality);
	if (!wanted) return { value: 0.5, reason: "Client has no locality preference" };
	if (actual && (actual === wanted || actual.includes(wanted) || wanted.includes(actual))) {
		return { value: 1, reason: `In ${property.location.locality}, the locality wanted` };
	}
	return { value: 0, reason: `In ${property.location?.locality || "another locality"}, not ${requirements.locality}` };
};

const bedroomFit = (requirements, property) => {
	const wanted = requirements.bedrooms;
	const actual = property.specs?.bedrooms;
	if (!isNum(wanted) || wanted === 0) return { value: 0.5, reason: "No bedroom preference" };
	if (!isNum(actual)) return { value: 0.25, reason: "Bedrooms not listed" };
	const diff = Math.abs(actual - wanted);
	if (diff === 0) return { value: 1, reason: `${actual} BHK as wanted` };
	return {
		value: diff === 1 ? 0.5 : 0,
		reason: `${actual} BHK, client wants ${wanted} BHK`,
	};
};

const freshness = (_requirements, property, now) => {
	const created = new Date(property.createdAt || now).getTime();
	const ageDays = Math.max(0, (now - created) / DAY_MS);
	return {
		value: Math.pow(0.5, ageDays / config.freshnessHalfLifeDays),
		reason: ageDays < 1 ? "Listed today" : `Listed ${Math.round(ageDays)} days ago`,
	};
};

const FEATURES = { budget: budgetFit, locality: localityFit, area: areaFit, bedrooms: bedroomFit, freshness };

/**
 * @returns {{ score, breakdown: [{ feature, value, weight, contribution, reason }] }}
 */
const scoreMatch = (client, property, { now = Date.now(), weights = config.weights } = {}) => {
	const requirements = client.requirements || {};
	const breakdown = Object.entries(FEATURES).map(([feature, fn]) => {
		const { value, reason } = fn(requirements, property, now);
		const weight = weights[feature] ?? 0;
		return { feature, value: round(value), weight, contribution: round(value * weight), reason };
	});
	const score = round(breakdown.reduce((sum, f) => sum + f.contribution, 0));
	return { score, breakdown: breakdown.sort((a, b) => b.contribution - a.contribution) };
};

// ---- retrieval ------------------------------------------------------------

const propertyCandidates = async (client) => {
	const r = client.requirements || {};
	if (!r.cityKey) return [];
	const [linked, dismissed] = await Promise.all([
		Match.find({ client: client._id }).distinct("property"),
		RecommendationEvent.find({ client: client._id, action: "dismissed" }).distinct("property"),
	]);
	const filter = {
		status: "available",
		"location.cityKey": r.cityKey,
		_id: { $nin: [...linked, ...dismissed] },
	};
	if (r.propertyType) filter.propertyType = r.propertyType;
	if (isNum(r.maxBudget)) filter["pricing.askingPrice"] = { $lte: r.maxBudget * config.budgetStretch };
	return Property.find(filter).sort({ createdAt: -1 }).limit(config.maxCandidates).lean();
};

const clientCandidates = async (property, user) => {
	const price = property.pricing?.askingPrice;
	const cityKey = property.location?.cityKey;
	if (!cityKey) return [];
	const linked = await Match.find({ property: property._id }).distinct("client");
	const filter = {
		"requirements.cityKey": cityKey,
		pipelineStage: { $in: ACTIVE_STAGES },
		_id: { $nin: linked },
		$and: [
			{ $or: [{ "requirements.propertyType": property.propertyType }, { "requirements.propertyType": null }] },
			...(isNum(price) ?
				[{ $or: [{ "requirements.maxBudget": { $gte: price / config.budgetStretch } }, { "requirements.maxBudget": null }] }]
			:	[]),
		],
	};
	if (user && !isAdmin(user)) filter.assignedBroker = user._id;
	return Client.find(filter).limit(config.maxCandidates).lean();
};

const rank = (pairs, k) =>
	topK(pairs, k).map((entry, index) => ({ ...entry, rank: index + 1 }));

/** Best k available properties for a client, with reasons. */
const recommendProperties = async (client, { k = 10, now = Date.now() } = {}) => {
	const candidates = await propertyCandidates(client);
	const scored = candidates.map((property) => ({ property, ...scoreMatch(client, property, { now }) }));
	return { candidates: candidates.length, results: rank(scored, k) };
};

/** Best k active clients for a property (brokers see only their own clients). */
const interestedClients = async (property, { user, k = 10, now = Date.now() } = {}) => {
	const candidates = await clientCandidates(property, user);
	const scored = candidates.map((client) => ({ client, ...scoreMatch(client, property, { now }) }));
	return { candidates: candidates.length, results: rank(scored, k) };
};

module.exports = {
	scoreMatch,
	recommendProperties,
	interestedClients,
	clientCandidates,
	ACTIVE_STAGES,
};

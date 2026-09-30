/**
 * Re-match alerts: when a property changes in a way that affects matching
 * (price, status, size, bedrooms, type, location) or a new one is listed, find
 * the clients it now suits and tell their brokers.
 *
 * Flow: the change and a PropertyChanged event commit together (outbox) →
 * the worker claims the event → for each candidate client, score the property
 * before and after the change → alert when the score crosses the threshold
 * (before < t ≤ after). Alerts are unique per (event, client), so reprocessing
 * an event after a crash or retry never alerts twice.
 */
const OutboxEvent = require("../models/OutboxEvent");
const Alert = require("../models/Alert");
const { scoreMatch, clientCandidates, isEligible } = require("./matchingService");
const config = require("../config/matchingWeights");
const { formatINR } = require("../utils/money");
const logger = require("../config/logger");

const WATCHED_FIELDS = [
	"pricing.askingPrice",
	"status",
	"specs.area",
	"specs.bedrooms",
	"propertyType",
	"location.city",
	"location.locality",
];
const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 30 * 1000;
const STUCK_AFTER_MS = 5 * 60 * 1000;

// Everything the scorer reads, and nothing else.
const matchingSnapshot = (property) => {
	const p = property.toObject ? property.toObject() : property;
	return {
		_id: p._id,
		title: p.title,
		propertyType: p.propertyType ?? null,
		status: p.status,
		location: { city: p.location?.city, cityKey: p.location?.cityKey ?? p.location?.city?.trim().toLowerCase(), locality: p.location?.locality ?? null },
		pricing: { askingPrice: p.pricing?.askingPrice ?? null },
		specs: { area: p.specs?.area ?? null, bedrooms: p.specs?.bedrooms ?? null },
		createdAt: p.createdAt ?? new Date(),
	};
};

/** Call inside the transaction that changes the property. */
const emitPropertyChanged = async ({ before, after, changedFields, session }) => {
	if (before && !changedFields.some((field) => WATCHED_FIELDS.includes(field))) return null;
	const [event] = await OutboxEvent.create(
		[
			{
				type: "PropertyChanged",
				payload: {
					propertyId: after._id,
					reason: before ? "updated" : "created",
					changedFields: changedFields.filter((field) => WATCHED_FIELDS.includes(field)),
					before: before ? matchingSnapshot(before) : null,
					after: matchingSnapshot(after),
				},
			},
		],
		{ session },
	);
	return event;
};

const describeChange = ({ reason, before, after }) => {
	if (reason === "created") return "New listing";
	const was = before?.pricing?.askingPrice;
	const now = after.pricing?.askingPrice;
	if (before?.status !== "available" && after.status === "available") return "Back on the market";
	if (was && now && now < was) return `Price dropped from ${formatINR(was)} to ${formatINR(now)}`;
	if (was && now && now > was) return `Price changed to ${formatINR(now)}`;
	return "Listing details changed";
};

/**
 * Pure decision for one event: which clients newly cross the threshold.
 * @returns [{ client, before, after }]
 */
const crossingClients = async (event) => {
	const { before, after } = event.payload;
	if (after.status !== "available") return [];
	const now = new Date(event.createdAt).getTime();
	const candidates = await clientCandidates(after);

	// Before the change, a listing the client would never have been shown
	// (sold, other city or type, >10% over budget) counts as score 0, however
	// well it matched otherwise: becoming eligible is exactly what we alert on.
	return candidates
		.map((client) => ({
			client,
			before: before && isEligible(client, before) ? scoreMatch(client, before, { now }).score : 0,
			after: scoreMatch(client, after, { now }).score,
		}))
		.filter(({ client, before: b, after: a }) => client.assignedBroker && b < config.alertThreshold && a >= config.alertThreshold);
};

const processEvent = async (event) => {
	const crossings = await crossingClients(event);
	if (!crossings.length) return 0;
	const { after } = event.payload;
	const change = describeChange(event.payload);

	// Upsert per (eventId, client): reprocessing inserts nothing new.
	const result = await Alert.bulkWrite(
		crossings.map(({ client, after: score }) => ({
			updateOne: {
				filter: { eventId: event._id, client: client._id },
				update: {
					$setOnInsert: {
						user: client.assignedBroker,
						kind: "new_match",
						title: `New match for ${client.name}: ${after.title}`,
						body: `${change} · ${Math.round(score * 100)}% match`,
						href: `/clients/${client._id}`,
						property: after._id,
						score,
					},
				},
				upsert: true,
			},
		})),
		{ ordered: false },
	);
	return result.upsertedCount;
};

const backoff = (attempts) => new Date(Date.now() + BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));

/** Claims and processes due events one at a time (atomic queued → processing). */
const dispatchEvents = async ({ limit = 20 } = {}) => {
	let processed = 0;
	for (; processed < limit; processed += 1) {
		const event = await OutboxEvent.findOneAndUpdate(
			{ status: "queued", nextAttemptAt: { $lte: new Date() } },
			{ $set: { status: "processing" }, $inc: { attempts: 1 } },
			{ returnDocument: "after", sort: { createdAt: 1 } },
		);
		if (!event) break;
		try {
			await processEvent(event);
			event.status = "done";
			event.processedAt = new Date();
			event.lastError = undefined;
		} catch (error) {
			event.lastError = error.message;
			event.status = event.attempts >= MAX_ATTEMPTS ? "dead" : "queued";
			if (event.status === "queued") event.nextAttemptAt = backoff(event.attempts);
			logger.error({ err: error, eventId: event._id }, "Outbox event failed");
		}
		await event.save();
	}
	return processed;
};

// A crash between claim and completion leaves events in "processing"; retry them.
const reclaimStuckEvents = async () => {
	const result = await OutboxEvent.updateMany(
		{ status: "processing", updatedAt: { $lt: new Date(Date.now() - STUCK_AFTER_MS) } },
		{ $set: { status: "queued", nextAttemptAt: new Date() } },
	);
	return result.modifiedCount;
};

// For /readyz: how long the oldest unprocessed event has been waiting.
const oldestPendingAgeSeconds = async () => {
	const oldest = await OutboxEvent.findOne({ status: { $in: ["queued", "processing"] } })
		.sort({ createdAt: 1 })
		.select("createdAt")
		.lean();
	return oldest ? Math.round((Date.now() - oldest.createdAt.getTime()) / 1000) : 0;
};

// Best-effort processing right after a commit; the worker retries anything missed.
const processSoon = () => {
	if (process.env.NODE_ENV === "test") return;
	setImmediate(() => {
		dispatchEvents().catch((error) => logger.error({ err: error }, "Event dispatch failed"));
	});
};

module.exports = {
	WATCHED_FIELDS,
	emitPropertyChanged,
	matchingSnapshot,
	crossingClients,
	processEvent,
	dispatchEvents,
	reclaimStuckEvents,
	oldestPendingAgeSeconds,
	processSoon,
	STUCK_AFTER_MS,
};

/**
 * Buyer shortlist links: a broker picks properties for a client and shares one
 * URL (e.g. on WhatsApp). The buyer opens it without an account and reacts to
 * each property; reactions update the client's matches and alert the broker.
 *
 * Security:
 * - 256-bit random token in the URL; only its SHA-256 is stored.
 * - Expired, revoked and unknown tokens all look the same: 404.
 * - The public view is an allow-list of fields: no dealer contacts, notes,
 *   codes or client details beyond a first name.
 */
const crypto = require("crypto");
const mongoose = require("mongoose");
const ShortlistLink = require("../models/ShortlistLink");
const ShortlistFeedback = require("../models/ShortlistFeedback");
const Property = require("../models/Property");
const Client = require("../models/Client");
const User = require("../models/User");
const Match = require("../models/Match");
const Alert = require("../models/Alert");
const { HttpError } = require("../utils/httpError");
const { isAdmin, sameId } = require("../policies");
const audit = require("./auditService");

const DAY_MS = 24 * 60 * 60 * 1000;
const REACTION_INTEREST = { like: "high", visit: "high", dislike: "low" };
const REACTION_TEXT = { like: "liked", dislike: "passed on", visit: "wants to visit" };

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/; // 32 bytes, base64url
const notFound = () => new HttpError(404, "This link is invalid or has expired", { code: "LINK_NOT_FOUND" });

const linkStatus = (link, now = Date.now()) =>
	link.revokedAt ? "revoked"
	: new Date(link.expiresAt).getTime() <= now ? "expired"
	: "active";

const createLink = async ({ client, propertyIds, expiresInDays, actor }) => {
	const unique = [...new Set(propertyIds.map(String))];
	const properties = await Property.find({ _id: { $in: unique } }).select("_id title").lean();
	if (properties.length !== unique.length) {
		throw new HttpError(400, "Some properties don't exist or were deleted", { code: "UNKNOWN_PROPERTY" });
	}

	const token = crypto.randomBytes(32).toString("base64url");
	let link;
	await mongoose.connection.transaction(async (session) => {
		[link] = await ShortlistLink.create(
			[
				{
					tokenHash: hashToken(token),
					client: client._id,
					properties: unique,
					createdBy: actor._id,
					expiresAt: new Date(Date.now() + expiresInDays * DAY_MS),
				},
			],
			{ session },
		);
		await audit.record(
			{
				actor: actor._id,
				action: "shortlist.create",
				entityType: "shortlist",
				entityId: link._id,
				subject: { type: "client", id: client._id },
				summary: `Shared a shortlist of ${unique.length} propert${unique.length === 1 ? "y" : "ies"} with ${client.name} (expires in ${expiresInDays} days)`,
				after: { properties: unique, expiresAt: link.expiresAt },
			},
			{ session },
		);
	});
	// The token is returned exactly once; it can't be recovered later.
	return { link, token };
};

const findActive = async (token, session) => {
	if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) throw notFound();
	const link = await ShortlistLink.findOne({ tokenHash: hashToken(token) }).session(session || null);
	if (!link || linkStatus(link) !== "active") throw notFound();
	return link;
};

// The only fields a buyer ever sees.
const publicProperty = (p) => ({
	_id: p._id,
	title: p.title,
	propertyType: p.propertyType,
	status: p.status,
	location: { city: p.location?.city, locality: p.location?.locality },
	price: p.pricing?.askingPrice ?? null,
	specs: {
		area: p.specs?.area ?? null,
		bedrooms: p.specs?.bedrooms ?? null,
		bathrooms: p.specs?.bathrooms ?? null,
		floor: p.specs?.floor ?? null,
		totalFloors: p.specs?.totalFloors ?? null,
		parking: p.specs?.parking ?? null,
		furnished: p.specs?.furnished ?? null,
	},
	images: (p.images || []).map((image) => image.url).filter(Boolean),
});

const publicView = async (token) => {
	const link = await findActive(token);
	const now = new Date();
	await ShortlistLink.updateOne(
		{ _id: link._id },
		{ $inc: { openCount: 1 }, $set: { lastOpenedAt: now, ...(link.firstOpenedAt ? {} : { firstOpenedAt: now }) } },
	);

	const [client, broker, properties, feedback] = await Promise.all([
		Client.findById(link.client).select("name").lean(),
		User.findById(link.createdBy).select("name").lean(),
		Property.find({ _id: { $in: link.properties } }).lean(),
		ShortlistFeedback.find({ link: link._id }).lean(),
	]);
	const reactions = new Map(feedback.map((f) => [String(f.property), { reaction: f.reaction, comment: f.comment ?? null }]));
	const order = new Map(link.properties.map((id, i) => [String(id), i]));

	return {
		buyerFirstName: client?.name?.trim().split(/\s+/)[0] || null,
		brokerName: broker?.name || null,
		expiresAt: link.expiresAt,
		properties: properties
			.sort((a, b) => order.get(String(a._id)) - order.get(String(b._id)))
			.map((p) => ({ ...publicProperty(p), feedback: reactions.get(String(p._id)) || null })),
	};
};

/**
 * Idempotent: the same reaction twice changes nothing and alerts nobody twice.
 * A changed reaction updates the row, the match's interest level, the audit
 * trail and alerts the broker again.
 */
const recordFeedback = async ({ token, propertyId, reaction, comment }) => {
	let outcome;
	await mongoose.connection.transaction(async (session) => {
		const link = await findActive(token, session);
		// A link can only carry feedback about its own properties.
		if (!link.properties.some((id) => sameId(id, propertyId))) throw notFound();

		const existing = await ShortlistFeedback.findOne({ link: link._id, property: propertyId }).session(session);
		const normalizedComment = comment?.trim() || undefined;
		if (existing && existing.reaction === reaction && (existing.comment || undefined) === normalizedComment) {
			outcome = { changed: false, reaction };
			return;
		}

		await ShortlistFeedback.updateOne(
			{ link: link._id, property: propertyId },
			{
				$set: { reaction, ...(normalizedComment ? { comment: normalizedComment } : {}) },
				...(normalizedComment ? {} : { $unset: { comment: "" } }),
				$setOnInsert: { client: link.client },
			},
			{ upsert: true, session },
		);

		const interestLevel = REACTION_INTEREST[reaction];
		const match = await Match.findOneAndUpdate(
			{ client: link.client, property: propertyId },
			{
				$set: { interestLevel },
				$setOnInsert: { createdBy: link.createdBy, notes: "From the buyer's shortlist link" },
			},
			{ upsert: true, returnDocument: "before", session },
		);

		const [client, property] = await Promise.all([
			Client.findById(link.client).select("name assignedBroker").session(session).lean(),
			Property.findById(propertyId).select("title propertyCode").session(session).lean(),
		]);
		// Same reaction with a new note: say so, rather than repeating "liked".
		const noteOnly = existing?.reaction === reaction;
		const text =
			noteOnly ?
				`${client.name} added a note on ${property.title}`
			:	`${client.name} ${REACTION_TEXT[reaction]} ${property.title}`;

		await audit.record(
			{
				actor: null,
				action: "shortlist.feedback",
				entityType: "shortlist",
				entityId: link._id,
				subject: { type: "client", id: link.client },
				summary: `${text} (via shortlist link)`,
				before: existing ? { reaction: existing.reaction } : null,
				after: { property: property._id, reaction, comment: normalizedComment ?? null, interestLevel, matchCreated: !match },
				meta: { via: "buyer-link" },
			},
			{ session },
		);

		const recipient = client.assignedBroker || link.createdBy;
		await Alert.create(
			[
				{
					user: recipient,
					kind: "shortlist_feedback",
					title: text,
					body: normalizedComment ? `“${normalizedComment}”` : undefined,
					href: `/clients/${link.client}`,
					client: link.client,
					property: property._id,
				},
			],
			{ session },
		);
		outcome = { changed: true, reaction };
	});
	return outcome;
};

const canManage = (user, link, client) =>
	isAdmin(user) || sameId(link.createdBy, user._id) || sameId(client?.assignedBroker, user._id);

const revokeLink = async ({ linkId, actor }) => {
	const link = await ShortlistLink.findById(linkId);
	if (!link) throw new HttpError(404, "Shortlist not found");
	const client = await Client.findById(link.client).select("name assignedBroker").lean();
	if (!canManage(actor, link, client)) throw new HttpError(403, "You can't revoke this shortlist");
	if (link.revokedAt) return link;

	await mongoose.connection.transaction(async (session) => {
		link.revokedAt = new Date();
		link.revokedBy = actor._id;
		await link.save({ session });
		await audit.record(
			{
				actor: actor._id,
				action: "shortlist.revoke",
				entityType: "shortlist",
				entityId: link._id,
				subject: { type: "client", id: link.client },
				summary: `Revoked a shortlist link for ${client?.name || "a client"}`,
			},
			{ session },
		);
	});
	return link;
};

const listForClient = async (clientId) => {
	const links = await ShortlistLink.find({ client: clientId })
		.sort({ createdAt: -1 })
		.populate("properties", "title propertyCode pricing location")
		.populate("createdBy", "name")
		.lean();
	const feedback = await ShortlistFeedback.find({ link: { $in: links.map((l) => l._id) } }).lean();
	return links.map(({ tokenHash, ...link }) => ({
		...link,
		status: linkStatus(link),
		feedback: feedback
			.filter((f) => sameId(f.link, link._id))
			.map((f) => ({ property: f.property, reaction: f.reaction, comment: f.comment ?? null, updatedAt: f.updatedAt })),
	}));
};

module.exports = { createLink, publicView, recordFeedback, revokeLink, listForClient, hashToken, linkStatus };

/**
 * Tamper-evident audit log.
 *
 * record() appends one entry inside the caller's transaction: it advances the
 * `audit` counter (seq + hash of the previous entry) and stores
 *   hash = sha256(prevHash + canonicalJSON(entry body)).
 * Because the counter document is written by every audit entry, concurrent
 * transactions serialize on it (MongoDB write conflict + retry), so the chain
 * never forks. That single hot document is the known scaling limit: fine at
 * CRM volumes; at much higher write rates you'd chain per entity or hash batches.
 *
 * If the caller's transaction aborts, its audit entry disappears with it.
 */
const crypto = require("crypto");
const mongoose = require("mongoose");
const AuditLog = require("../models/AuditLog");
const Counter = require("../models/Counter");
const { canonicalJson } = require("../utils/canonicalJson");
const { getRequestContext } = require("../utils/requestContext");

const GENESIS_HASH = "0".repeat(64);
const COUNTER_ID = "audit";

// The exact fields covered by the hash, with explicit defaults so a record
// hashes identically before it is written and after it is read back.
const hashedBody = (entry) => ({
	seq: entry.seq,
	at: entry.at,
	actor: entry.actor ?? null,
	action: entry.action,
	entityType: entry.entityType,
	entityId: entry.entityId ?? null,
	subject: entry.subject?.id ? { type: entry.subject.type, id: entry.subject.id } : null,
	summary: entry.summary,
	before: entry.before ?? null,
	after: entry.after ?? null,
	meta: entry.meta ?? null,
	requestId: entry.requestId ?? null,
	legacy: Boolean(entry.legacy),
});

const computeHash = (prevHash, entry) =>
	crypto
		.createHash("sha256")
		.update(prevHash + canonicalJson(hashedBody(entry)))
		.digest("hex");

const append = async (event, session) => {
	// returnDocument "before": the previous seq and chain head (null on the first entry).
	const head = await Counter.findOneAndUpdate(
		{ _id: COUNTER_ID },
		{ $inc: { seq: 1 } },
		{ upsert: true, returnDocument: "before", session },
	).lean();

	const entry = {
		...event,
		seq: (head?.seq || 0) + 1,
		at: event.at || new Date(),
		requestId: event.requestId ?? getRequestContext().requestId ?? null,
		prevHash: head?.lastHash || GENESIS_HASH,
	};
	entry.hash = computeHash(entry.prevHash, entry);

	await Counter.updateOne({ _id: COUNTER_ID }, { $set: { lastHash: entry.hash } }, { session });
	const [doc] = await AuditLog.create([entry], { session });
	return doc;
};

/**
 * @param event { actor, action, entityType, entityId, subject?, summary, before?, after?, meta? }
 * @param options.session  the caller's transaction; without one, the entry gets its own.
 */
const record = async (event, { session } = {}) => {
	if (session) return append(event, session);
	let doc;
	await mongoose.connection.transaction(async (own) => {
		doc = await append(event, own);
	});
	return doc;
};

// Before/after maps for a list of { field, oldValue, newValue } changes.
const changeSets = (changes) => ({
	before: Object.fromEntries(changes.map((c) => [c.field, c.oldValue ?? null])),
	after: Object.fromEntries(changes.map((c) => [c.field, c.newValue ?? null])),
});

/**
 * Walks the chain in seq order and recomputes every hash.
 * @returns {{ ok, checked, firstBrokenSeq?, reason? }}
 */
const verifyChain = async () => {
	let prevHash = GENESIS_HASH;
	let expectedSeq = 1;
	let checked = 0;

	const cursor = AuditLog.find().sort({ seq: 1 }).lean().cursor();
	for await (const entry of cursor) {
		const broken = (reason) => ({ ok: false, checked, firstBrokenSeq: expectedSeq, reason });
		if (entry.seq !== expectedSeq) return broken(`missing entry (found seq ${entry.seq})`);
		if (entry.prevHash !== prevHash) return broken("prevHash does not match the previous entry");
		if (computeHash(entry.prevHash, entry) !== entry.hash) return broken("entry contents were modified");
		prevHash = entry.hash;
		expectedSeq += 1;
		checked += 1;
	}

	const head = await Counter.findById(COUNTER_ID).lean();
	if (head && (head.seq !== checked || (checked > 0 && head.lastHash !== prevHash))) {
		return { ok: false, checked, firstBrokenSeq: checked + 1, reason: "entries after the last one were deleted" };
	}
	return { ok: true, checked };
};

module.exports = { record, verifyChain, computeHash, hashedBody, changeSets, GENESIS_HASH, COUNTER_ID };

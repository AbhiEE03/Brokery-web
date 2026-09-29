const AuditLog = require("../models/AuditLog");
const { toSkip, paginationMeta } = require("../utils/pagination");
const { isAdmin } = require("../policies");
const { verifyChain } = require("../services/auditService");

const buildFilter = (user, { entityType, broker, action, from, to }) => {
	const filter = {};

	// Brokers only see their own actions; admins can filter by broker.
	if (!isAdmin(user)) filter.actor = user._id;
	else if (broker) filter.actor = broker;

	if (entityType) filter.entityType = entityType;
	if (action) filter.action = action;
	if (from || to) {
		filter.at = {};
		if (from) filter.at.$gte = from;
		if (to) filter.at.$lte = to;
	}
	return filter;
};

// Shape kept compatible with the activity feed UI (performedBy/action/entity/createdAt).
const toFeedItem = (entry) => ({
	_id: entry._id,
	seq: entry.seq,
	performedBy: entry.actor,
	action: entry.summary,
	actionCode: entry.action,
	entity: entry.entityType,
	entityId: entry.entityId,
	subject: entry.subject?.id ? entry.subject : null,
	before: entry.before,
	after: entry.after,
	meta: entry.meta,
	requestId: entry.requestId,
	legacy: entry.legacy,
	hash: entry.hash,
	createdAt: entry.at,
});

/**
 * Two pagination modes:
 * - ?page=N (offset) — what the UI uses today; cost grows with the page number.
 * - ?cursor=<seq> (keyset) — constant cost at any depth: "entries older than the
 *   last one I saw". The audit sequence is a gap-free, unique sort key.
 * Every response includes nextCursor for keyset clients.
 */
const listEntries = async (filter, query) => {
	const { page, limit, cursor } = query;
	let find = AuditLog.find(cursor ? { ...filter, seq: { $lt: cursor } } : filter);
	if (!cursor) find = find.skip(toSkip({ page, limit }));

	const [entries, total] = await Promise.all([
		find.sort({ seq: -1 }).limit(limit).populate("actor", "name email role").lean(),
		AuditLog.countDocuments(filter),
	]);

	return {
		data: entries.map(toFeedItem),
		pagination: {
			...paginationMeta({ page, limit }, total),
			nextCursor: entries.length === limit ? entries[entries.length - 1].seq : null,
		},
	};
};

exports.getLogs = async (req, res) => {
	const query = req.validated.query;
	const result = await listEntries(buildFilter(req.user, query), query);
	res.status(200).json({ success: true, ...result });
};

// History of one record: entries about it directly, plus change requests,
// matches and claims whose subject it is.
exports.getLogsByEntity = async (req, res) => {
	const query = req.validated.query;
	const { entityId } = req.validated.params;
	const filter = {
		...buildFilter(req.user, query),
		$or: [{ entityId }, { "subject.id": entityId }],
	};
	const result = await listEntries(filter, query);
	res.status(200).json({ success: true, ...result });
};

exports.verifyAuditChain = async (req, res) => {
	res.status(200).json({ success: true, data: await verifyChain() });
};

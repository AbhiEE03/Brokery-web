const mongoose = require("mongoose");
const ActivityLog = require("../models/ActivityLog");
const { toSkip, paginationMeta } = require("../utils/pagination");
const { isAdmin } = require("../policies");

const encodeCursor = (log) => `${log.createdAt.toISOString()}_${log._id}`;

const decodeCursor = (cursor) => {
	const [createdAt, id] = cursor.split("_");
	return { createdAt: new Date(createdAt), id: new mongoose.Types.ObjectId(id) };
};

const buildFilter = (user, { entityType, broker, from, to }) => {
	const filter = {};

	// Brokers only see their own actions; admins can filter by broker.
	if (!isAdmin(user)) filter.performedBy = user._id;
	else if (broker) filter.performedBy = broker;

	if (entityType) filter.entity = entityType;
	if (from || to) {
		filter.createdAt = {};
		if (from) filter.createdAt.$gte = from;
		if (to) filter.createdAt.$lte = to;
	}
	return filter;
};

/**
 * Two pagination modes:
 * - ?page=N (offset) — what the UI uses today; cost grows with the page number.
 * - ?cursor=… (keyset) — constant cost at any depth: "createdAt/_id before the
 *   last row I saw", served by the { createdAt: -1, _id: -1 } index.
 * Every response includes nextCursor for keyset clients.
 */
const listLogs = async (filter, query) => {
	const { page, limit, cursor } = query;
	let find = ActivityLog.find(filter);

	if (cursor) {
		const { createdAt, id } = decodeCursor(cursor);
		find = ActivityLog.find({
			...filter,
			$or: [{ createdAt: { $lt: createdAt } }, { createdAt, _id: { $lt: id } }],
		});
	} else {
		find = find.skip(toSkip({ page, limit }));
	}

	const [logs, total] = await Promise.all([
		find
			.sort({ createdAt: -1, _id: -1 })
			.limit(limit)
			.populate("performedBy", "name email role")
			.lean(),
		ActivityLog.countDocuments(filter),
	]);

	return {
		data: logs,
		pagination: {
			...paginationMeta({ page, limit }, total),
			nextCursor: logs.length === limit ? encodeCursor(logs[logs.length - 1]) : null,
		},
	};
};

exports.getLogs = async (req, res) => {
	const query = req.validated.query;
	const result = await listLogs(buildFilter(req.user, query), query);
	res.status(200).json({ success: true, ...result });
};

exports.getLogsByEntity = async (req, res) => {
	const query = req.validated.query;
	const filter = {
		...buildFilter(req.user, query),
		entityId: req.validated.params.entityId,
	};
	const result = await listLogs(filter, query);
	res.status(200).json({ success: true, ...result });
};

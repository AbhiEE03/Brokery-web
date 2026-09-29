const ActivityLog = require("../models/ActivityLog");
const { toSkip, paginationMeta } = require("../utils/pagination");

const buildQuery = (req) => {
	const query = {};

	if (req.user.role === "broker") {
		query.performedBy = req.user._id;
	}

	return query;
};

exports.getLogs = async (req, res) => {
	try {
		const query = buildQuery(req);
		const { page, limit } = req.validated.query;
		const skip = toSkip({ page, limit });

		const [logs, total] = await Promise.all([
			ActivityLog.find(query)
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.populate("performedBy", "name email role")
				.lean(),
			ActivityLog.countDocuments(query),
		]);

		res.status(200).json({
			success: true,
			data: logs,
			pagination: paginationMeta({ page, limit }, total),
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

exports.getLogsByEntity = async (req, res) => {
	try {
		const query = {
			entityId: req.validated.params.entityId,
		};

		if (req.user.role === "broker") {
			query.performedBy = req.user._id;
		}

		const { page, limit } = req.validated.query;
		const skip = toSkip({ page, limit });

		const [logs, total] = await Promise.all([
			ActivityLog.find(query)
				.sort({ createdAt: -1 })
				.skip(skip)
				.limit(limit)
				.populate("performedBy", "name email role")
				.lean(),
			ActivityLog.countDocuments(query),
		]);

		res.status(200).json({
			success: true,
			data: logs,
			pagination: paginationMeta({ page, limit }, total),
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};
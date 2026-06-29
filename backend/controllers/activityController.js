const ActivityLog = require("../models/ActivityLog");

const buildQuery = (req) => {
	const query = {};

	if (req.user.role === "broker") {
		query.performedBy = req.user._id;
	}

	return query;
};

const getPagination = (req) => {
	const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
	const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
	const skip = (page - 1) * limit;

	return { page, limit, skip };
};

exports.getLogs = async (req, res) => {
	try {
		const query = buildQuery(req);
		const { page, limit, skip } = getPagination(req);

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
			pagination: {
				page,
				limit,
				total,
				pages: Math.ceil(total / limit),
			},
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
			entityId: req.params.entityId,
		};

		if (req.user.role === "broker") {
			query.performedBy = req.user._id;
		}

		const { page, limit, skip } = getPagination(req);

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
			pagination: {
				page,
				limit,
				total,
				pages: Math.ceil(total / limit),
			},
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};
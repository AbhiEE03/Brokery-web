const ActivityLog = require("../models/ActivityLog");

const logActivity = (action, entity, getEntityId) => {
	return (req, res, next) => {
		const originalJson = res.json.bind(res);

		res.json = (payload) => {
			const response = originalJson(payload);

			if (res.statusCode < 400 && req.user?._id) {
				Promise.resolve(
					typeof action === "function" ? action(req, payload) : action,
				)
					.then((resolvedAction) => {
						if (!resolvedAction) {
							return null;
						}

						return ActivityLog.create({
							performedBy: req.user._id,
							action: resolvedAction,
							entity,
							entityId: getEntityId ? getEntityId(req, payload) : null,
							metadata: {
								method: req.method,
								path: req.originalUrl,
								statusCode: res.statusCode,
							},
						});
					})
					.catch((error) => {
						console.error("Activity log failed:", error.message);
					});
			}

			return response;
		};

		next();
	};
};

module.exports = logActivity;
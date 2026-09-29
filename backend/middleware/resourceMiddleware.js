const mongoose = require("mongoose");
const { can } = require("../policies");

/**
 * Loads a document by route param into req.resource.
 * 400 for malformed ids, 404 when missing. Runs before authorize().
 */
const loadResource = (Model, resourceType, { param = "id", populate } = {}) => {
	return async (req, res, next) => {
		const id = req.params[param];

		if (!mongoose.isValidObjectId(id)) {
			return res.status(400).json({ success: false, message: `Invalid ${param}` });
		}

		try {
			let query = Model.findById(id);
			if (populate) query = query.populate(populate);
			const resource = await query;

			if (!resource) {
				return res.status(404).json({
					success: false,
					message: `${Model.modelName} not found`,
				});
			}

			req.resource = resource;
			req.resourceType = resourceType;
			next();
		} catch (error) {
			next(error);
		}
	};
};

/** Checks the policy for req.resource. Must run after loadResource(). */
const authorize = (action) => {
	return (req, res, next) => {
		if (!can(req.user, action, req.resourceType, req.resource)) {
			return res.status(403).json({
				success: false,
				message: "You are not authorized to perform this action",
			});
		}
		next();
	};
};

module.exports = { loadResource, authorize };

const mongoose = require("mongoose");
const { can } = require("../policies");
const { HttpError } = require("../utils/httpError");

/**
 * Loads a document by route param into req.resource.
 * 400 for malformed ids, 404 when missing. Runs before authorize().
 */
const loadResource = (Model, resourceType, { param = "id", populate } = {}) => {
	return async (req, res, next) => {
		const id = req.params[param];

		if (!mongoose.isValidObjectId(id)) {
			return next(new HttpError(400, `Invalid ${param}`, { code: "INVALID_ID" }));
		}

		try {
			let query = Model.findById(id);
			if (populate) query = query.populate(populate);
			const resource = await query;

			if (!resource) {
				return next(new HttpError(404, `${Model.modelName} not found`, { code: "NOT_FOUND" }));
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
			return next(
				new HttpError(403, "You are not authorized to perform this action", {
					code: "FORBIDDEN",
				}),
			);
		}
		next();
	};
};

module.exports = { loadResource, authorize };

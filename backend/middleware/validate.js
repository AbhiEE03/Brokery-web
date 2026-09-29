const { ZodError } = require("zod");

const formatIssues = (error) =>
	error.issues.map((issue) => ({
		path: issue.path.join("."),
		message: issue.message,
	}));

/**
 * validate({ body, query, params }) — parses each part with its Zod schema.
 * Parsed body replaces req.body (unknown keys stripped); parsed query/params
 * are exposed as req.validated.query / req.validated.params because Express 5
 * makes req.query read-only.
 */
const validate = (schemas) => {
	return (req, res, next) => {
		try {
			req.validated = req.validated || {};
			if (schemas.params) req.validated.params = schemas.params.parse(req.params);
			if (schemas.query) req.validated.query = schemas.query.parse(req.query);
			if (schemas.body) req.body = schemas.body.parse(req.body ?? {});
			next();
		} catch (error) {
			if (error instanceof ZodError) {
				return res.status(400).json({
					success: false,
					message: "Validation failed",
					errors: formatIssues(error),
				});
			}
			next(error);
		}
	};
};

module.exports = { validate, formatIssues };

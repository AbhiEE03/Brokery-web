const mongoose = require("mongoose");

class HttpError extends Error {
	constructor(status, message, { code, details } = {}) {
		super(message);
		this.name = "HttpError";
		this.status = status;
		this.code = code;
		this.details = details;
	}
}

/** Maps known error types to a JSON response. */
const sendError = (res, error) => {
	if (error instanceof HttpError) {
		return res.status(error.status).json({
			success: false,
			code: error.code,
			message: error.message,
			...(error.details ? { details: error.details } : {}),
		});
	}

	if (error instanceof mongoose.Error.ValidationError) {
		return res.status(400).json({
			success: false,
			code: "VALIDATION_ERROR",
			message: "Validation failed",
			errors: Object.values(error.errors).map((e) => ({
				path: e.path,
				message: e.message,
			})),
		});
	}

	console.error(error);
	return res.status(500).json({ success: false, message: "Internal server error" });
};

module.exports = { HttpError, sendError };

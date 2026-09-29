const mongoose = require("mongoose");
const multer = require("multer");
const logger = require("../config/logger");
const { HttpError } = require("../utils/httpError");

/**
 * Maps any thrown error to { status, body }. Every error response has the
 * same shape: { success: false, code, message, requestId, errors? }.
 */
const toErrorResponse = (error) => {
	if (error instanceof HttpError) {
		return {
			status: error.status,
			body: {
				code: error.code || "ERROR",
				message: error.message,
				...(error.details ? { details: error.details } : {}),
			},
		};
	}

	if (error instanceof mongoose.Error.ValidationError) {
		return {
			status: 400,
			body: {
				code: "VALIDATION_ERROR",
				message: "Validation failed",
				errors: Object.values(error.errors).map((e) => ({ path: e.path, message: e.message })),
			},
		};
	}

	if (error instanceof mongoose.Error.CastError) {
		return {
			status: 400,
			body: { code: "INVALID_VALUE", message: `Invalid value for ${error.path}` },
		};
	}

	if (error?.code === 11000) {
		const fields = Object.keys(error.keyPattern || {}).join(", ");
		return {
			status: 409,
			body: { code: "DUPLICATE", message: `Duplicate value for ${fields || "a unique field"}` },
		};
	}

	if (error instanceof multer.MulterError) {
		const tooLarge = error.code === "LIMIT_FILE_SIZE";
		return {
			status: tooLarge ? 413 : 400,
			body: {
				code: tooLarge ? "FILE_TOO_LARGE" : "UPLOAD_ERROR",
				message: tooLarge ? "File exceeds the 5 MB limit" : error.message,
			},
		};
	}

	// Raised by our Multer fileFilter.
	if (error?.name === "UploadRejectedError") {
		return { status: 400, body: { code: "UNSUPPORTED_FILE", message: error.message } };
	}

	// Malformed JSON body from express.json().
	if (error?.type === "entity.parse.failed") {
		return { status: 400, body: { code: "INVALID_JSON", message: "Malformed JSON body" } };
	}

	if (error?.type === "entity.too.large") {
		return { status: 413, body: { code: "PAYLOAD_TOO_LARGE", message: "Request body too large" } };
	}

	return {
		status: 500,
		body: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
	};
};

const errorHandler = (error, req, res, next) => {
	if (res.headersSent) return next(error);

	const { status, body } = toErrorResponse(error);
	const log = req.log || logger;
	if (status >= 500) {
		log.error({ err: error }, "Unhandled error");
	} else {
		log.debug({ err: error, status }, "Request failed");
	}

	res.status(status).json({ success: false, ...body, requestId: req.id });
};

const notFoundHandler = (req, res) => {
	res.status(404).json({
		success: false,
		code: "NOT_FOUND",
		message: `No route for ${req.method} ${req.path}`,
		requestId: req.id,
	});
};

module.exports = { errorHandler, notFoundHandler, toErrorResponse };

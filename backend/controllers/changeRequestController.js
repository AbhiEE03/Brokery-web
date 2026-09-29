const ChangeRequest = require("../models/ChangeRequest");
const {
	resolveChangeRequest,
	withdrawChangeRequest,
} = require("../services/approvalService");
const { toSkip, paginationMeta } = require("../utils/pagination");
const { isAdmin } = require("../policies");

const ENTITY_FIELDS = "name clientCode title propertyCode";

const populateRequest = (query) =>
	query
		.populate("entityId", ENTITY_FIELDS)
		.populate("requestedBy", "name email")
		.populate("resolvedBy", "name email");

exports.getChangeRequests = async (req, res) => {
	const { page, limit, status, entityType, from, to } = req.validated.query;
	const filter = {};

	if (!isAdmin(req.user)) filter.requestedBy = req.user._id;
	if (status) filter.status = status;
	if (entityType) filter.entityType = entityType;
	if (from || to) {
		filter.createdAt = {};
		if (from) filter.createdAt.$gte = from;
		if (to) filter.createdAt.$lte = to;
	}

	const [changeRequests, total] = await Promise.all([
		populateRequest(
			ChangeRequest.find(filter)
				.sort({ createdAt: -1, _id: -1 })
				.skip(toSkip({ page, limit }))
				.limit(limit),
		).lean(),
		ChangeRequest.countDocuments(filter),
	]);

	res.status(200).json({
		success: true,
		data: changeRequests,
		pagination: paginationMeta({ page, limit }, total),
	});
};

// Loaded and authorized by route middleware.
exports.getChangeRequestById = async (req, res) => {
	res.status(200).json({
		success: true,
		data: req.resource,
	});
};

const resolveWith = (getDecision) => async (req, res) => {
	const changeRequest = await resolveChangeRequest({
		id: req.params.id,
		decision: getDecision(req),
		actor: req.user,
		adminNote: req.body?.adminNote,
	});
	await changeRequest.populate("entityId", ENTITY_FIELDS);

	if (changeRequest.status === "conflict") {
		return res.status(409).json({
			success: false,
			code: "STALE_CHANGE_REQUEST",
			message: `Not applied: ${changeRequest.conflictFields.join(", ")} changed after this request was made`,
			data: changeRequest,
		});
	}

	res.status(200).json({
		success: true,
		message: `Change request ${changeRequest.status}`,
		data: changeRequest,
	});
};

exports.approveChangeRequest = resolveWith(() => "approved");
exports.rejectChangeRequest = resolveWith(() => "rejected");
// Legacy endpoint: PATCH /:id/resolve { action: "approved" | "rejected" }
exports.resolveChangeRequest = resolveWith((req) => req.body.action);

exports.withdrawChangeRequest = async (req, res) => {
	const changeRequest = await withdrawChangeRequest({
		id: req.params.id,
		actor: req.user,
	});
	res.status(200).json({
		success: true,
		message: "Change request withdrawn",
		data: changeRequest,
	});
};

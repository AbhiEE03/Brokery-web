const express = require("express");
const router = express.Router();
const {
	getChangeRequests,
	getChangeRequestById,
	approveChangeRequest,
	rejectChangeRequest,
	resolveChangeRequest,
	withdrawChangeRequest,
} = require("../controllers/changeRequestController");
const ChangeRequest = require("../models/ChangeRequest");
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");
const { loadResource, authorize } = require("../middleware/resourceMiddleware");
const { validate } = require("../middleware/validate");
const {
	idParams,
	listChangeRequestsQuery,
	decisionBody,
	resolveChangeRequestBody,
} = require("../validation/schemas");
const logActivity = require("../middleware/logActivity");

const logDecision = logActivity(
	(req, payload) => {
		const cr = payload?.data;
		if (!cr?.status) return null;
		const entity = cr.entityId?.name || cr.entityId?.title || cr.entityType;
		return `Change request for ${entity}: ${cr.status}`;
	},
	"change_request",
	(req) => req.params.id,
);

router.use(verifyToken);

router.get("/", validate({ query: listChangeRequestsQuery }), getChangeRequests);
router.get(
	"/:id",
	loadResource(ChangeRequest, "changeRequest", {
		populate: [
			{ path: "entityId", select: "name clientCode title propertyCode" },
			{ path: "requestedBy", select: "name email" },
			{ path: "resolvedBy", select: "name email" },
		],
	}),
	authorize("read"),
	getChangeRequestById,
);

const adminDecision = [requireAdmin, validate({ params: idParams, body: decisionBody }), logDecision];
router.post("/:id/approve", ...adminDecision, approveChangeRequest);
router.post("/:id/reject", ...adminDecision, rejectChangeRequest);
router.post("/:id/withdraw", validate({ params: idParams }), withdrawChangeRequest);

// Deprecated alias kept for older clients.
router.patch(
	"/:id/resolve",
	requireAdmin,
	validate({ params: idParams, body: resolveChangeRequestBody }),
	logDecision,
	resolveChangeRequest,
);

module.exports = router;

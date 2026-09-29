const express = require("express");
const router = express.Router();
const {
	getChangeRequests,
	getChangeRequestById,
	resolveChangeRequest,
} = require("../controllers/changeRequestController");
const ClientChangeRequest = require("../models/ClientChangeRequest");
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");
const { loadResource, authorize } = require("../middleware/resourceMiddleware");
const { validate } = require("../middleware/validate");
const { resolveChangeRequestBody } = require("../validation/schemas");
const logActivity = require("../middleware/logActivity");

router.use(verifyToken);

router.get("/", getChangeRequests);
router.get(
	"/:id",
	loadResource(ClientChangeRequest, "changeRequest", {
		populate: [
			{ path: "client", select: "name clientCode" },
			{ path: "requestedBy", select: "name email" },
		],
	}),
	authorize("read"),
	getChangeRequestById,
);
router.patch(
	"/:id/resolve",
	requireAdmin,
	validate({ body: resolveChangeRequestBody }),
	logActivity(
		(req, data) => `${req.body.action === 'approved' ? 'Approved' : 'Rejected'} change request for ${data?.data?.client ? 'client' : 'entity'} (${req.params.id})`,
		"change_request",
		(req) => req.params.id,
	),
	resolveChangeRequest,
);

module.exports = router;

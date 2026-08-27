const express = require("express");
const router = express.Router();
const {
	getChangeRequests,
	getChangeRequestById,
	resolveChangeRequest,
} = require("../controllers/changeRequestController");
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");
const logActivity = require("../middleware/logActivity");

router.get("/", verifyToken, getChangeRequests);
router.get("/:id", verifyToken, getChangeRequestById);
router.patch(
	"/:id/resolve",
	verifyToken,
	requireAdmin,
	logActivity(
		(req, data) => `${req.body.action === 'approve' ? 'Approved' : 'Rejected'} change request for ${data?.data?.entityType || 'entity'}`,
		"change_request",
		(req) => req.params.id,
	),
	resolveChangeRequest,
);

module.exports = router;

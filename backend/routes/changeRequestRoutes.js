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
		(req) => `${req.body.action} change request ${req.params.id}`,
		"change_request",
		(req) => req.params.id,
	),
	resolveChangeRequest,
);

module.exports = router;

const express = require("express");
const router = express.Router();
const {
	getChangeRequests,
	getChangeRequestById,
	resolveChangeRequest,
} = require("../controllers/changeRequestController");
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");

router.get("/", verifyToken, getChangeRequests);
router.get("/:id", verifyToken, getChangeRequestById);
router.patch("/:id/resolve", verifyToken, requireAdmin, resolveChangeRequest);

module.exports = router;

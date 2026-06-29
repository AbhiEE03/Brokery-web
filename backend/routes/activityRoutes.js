const express = require("express");
const router = express.Router();
const {
	getLogs,
	getLogsByEntity,
} = require("../controllers/activityController");
const { verifyToken } = require("../middleware/authMiddleware");

router.get("/", verifyToken, getLogs);
router.get("/entity/:entityId", verifyToken, getLogsByEntity);

module.exports = router;
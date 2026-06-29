const express = require("express");
const router = express.Router();
const {
	getSummary,
	getDealsByMonth,
	getPipelineDistribution,
	getBrokerPerformance,
	getPropertyByCity,
} = require("../controllers/analyticsController");
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");

router.get("/summary", verifyToken, requireAdmin, getSummary);
router.get("/deals-by-month", verifyToken, requireAdmin, getDealsByMonth);
router.get(
	"/pipeline-distribution",
	verifyToken,
	requireAdmin,
	getPipelineDistribution,
);
router.get(
	"/broker-performance",
	verifyToken,
	requireAdmin,
	getBrokerPerformance,
);
router.get("/property-by-city", verifyToken, requireAdmin, getPropertyByCity);

module.exports = router;

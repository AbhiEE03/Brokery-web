const express = require("express");
const router = express.Router();
const {
	getSummary,
	getDealsByMonth,
	getPipelineDistribution,
	getBrokerPerformance,
	getPropertyByCity,
	getFunnel,
	getTimeInStage,
} = require("../controllers/analyticsController");
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");

router.use(verifyToken, requireAdmin);

router.get("/summary", getSummary);
router.get("/deals-by-month", getDealsByMonth);
router.get("/pipeline-distribution", getPipelineDistribution);
router.get("/broker-performance", getBrokerPerformance);
router.get("/property-by-city", getPropertyByCity);
router.get("/funnel", getFunnel);
router.get("/time-in-stage", getTimeInStage);

module.exports = router;

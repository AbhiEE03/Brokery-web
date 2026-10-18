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
const { validate } = require("../middleware/validate");
const { pipelineDistributionQuery } = require("../validation/schemas");

// Clients per stage is what the pipeline board's column headers show, so brokers
// need it too (scoped to their own clients). Every other report is admin-only.
router.get("/pipeline-distribution", verifyToken, validate({ query: pipelineDistributionQuery }), getPipelineDistribution);

router.use(verifyToken, requireAdmin);

router.get("/summary", getSummary);
router.get("/deals-by-month", getDealsByMonth);
router.get("/broker-performance", getBrokerPerformance);
router.get("/property-by-city", getPropertyByCity);
router.get("/funnel", getFunnel);
router.get("/time-in-stage", getTimeInStage);

module.exports = router;

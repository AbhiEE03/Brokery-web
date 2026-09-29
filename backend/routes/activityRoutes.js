const express = require("express");
const router = express.Router();
const {
	getLogs,
	getLogsByEntity,
} = require("../controllers/activityController");
const { verifyToken } = require("../middleware/authMiddleware");
const { validate } = require("../middleware/validate");
const { listActivityQuery, entityParams } = require("../validation/schemas");

router.use(verifyToken);

router.get("/", validate({ query: listActivityQuery }), getLogs);
router.get(
	"/entity/:entityId",
	validate({ params: entityParams, query: listActivityQuery }),
	getLogsByEntity,
);

module.exports = router;

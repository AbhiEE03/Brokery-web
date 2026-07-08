const express = require("express");
const router = express.Router();
const {
	getMatches,
	createMatch,
	getMatchesByClient,
	getMatchesByProperty,
	updateMatch,
	deleteMatch,
} = require("../controllers/matchController");
const { verifyToken } = require("../middleware/authMiddleware");

router.get("/", verifyToken, getMatches);
router.post("/", verifyToken, createMatch);
router.get("/client/:clientId", verifyToken, getMatchesByClient);
router.get("/property/:propertyId", verifyToken, getMatchesByProperty);
router.patch("/:id", verifyToken, updateMatch);
router.delete("/:id", verifyToken, deleteMatch);

module.exports = router;

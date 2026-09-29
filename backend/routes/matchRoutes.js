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
const Match = require("../models/Match");
const Client = require("../models/Client");
const Property = require("../models/Property");
const { verifyToken } = require("../middleware/authMiddleware");
const { loadResource, authorize } = require("../middleware/resourceMiddleware");
const { validate } = require("../middleware/validate");
const { createMatchBody, updateMatchBody, listMatchesQuery } = require("../validation/schemas");

// The match policy needs the client's owner, so populate it.
const loadMatch = loadResource(Match, "match", {
	populate: { path: "client", select: "assignedBroker" },
});

router.use(verifyToken);

router.get("/", validate({ query: listMatchesQuery }), getMatches);
router.post("/", validate({ body: createMatchBody }), createMatch);
router.get(
	"/client/:clientId",
	loadResource(Client, "client", { param: "clientId" }),
	authorize("read"),
	getMatchesByClient,
);
router.get(
	"/property/:propertyId",
	loadResource(Property, "property", { param: "propertyId" }),
	authorize("read"),
	getMatchesByProperty,
);
router.patch("/:id", loadMatch, authorize("update"), validate({ body: updateMatchBody }), updateMatch);
router.delete("/:id", loadMatch, authorize("delete"), deleteMatch);

module.exports = router;

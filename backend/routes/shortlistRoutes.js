const express = require("express");
const { revokeShortlist, viewPublicShortlist, submitPublicFeedback } = require("../controllers/shortlistController");
const { verifyToken } = require("../middleware/authMiddleware");
const { validate } = require("../middleware/validate");
const { createPublicLimiters } = require("../middleware/rateLimit");
const { idParams, shortlistFeedbackBody } = require("../validation/schemas");

// Signed-in: revoke a link (creator, the client's broker or an admin).
const shortlistRouter = express.Router();
shortlistRouter.delete("/:id", verifyToken, validate({ params: idParams }), revokeShortlist);

// Public: the buyer's view of a link. No login; the token is the credential.
const publicRouter = express.Router();
const limiters = createPublicLimiters();
publicRouter.get("/shortlists/:token", ...limiters, viewPublicShortlist);
publicRouter.post("/shortlists/:token/feedback", ...limiters, validate({ body: shortlistFeedbackBody }), submitPublicFeedback);

module.exports = { shortlistRouter, publicRouter };

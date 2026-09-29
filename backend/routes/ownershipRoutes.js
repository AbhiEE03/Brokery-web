const express = require("express");
const router = express.Router();
const { getClaims, resolveClaim } = require("../controllers/ownershipController");
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");
const { validate } = require("../middleware/validate");
const { idParams, listOwnershipClaimsQuery, resolveOwnershipClaimBody } = require("../validation/schemas");

// Claims name both brokers and the existing client, so they are admin-only.
router.use(verifyToken, requireAdmin);

router.get("/", validate({ query: listOwnershipClaimsQuery }), getClaims);
router.post("/:id/resolve", validate({ params: idParams, body: resolveOwnershipClaimBody }), resolveClaim);

module.exports = router;

const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/authMiddleware");
const clientRules = require("../utils/clientEditRules");
const propertyRules = require("../utils/propertyEditRules");

router.use(verifyToken);

// Which fields apply immediately and which go to an admin for approval. Admins'
// own edits always apply directly (and are audited).
router.get("/edit-policies", (req, res) => {
	const policy = (rules) => ({ direct: rules.DIRECT_EDIT_FIELDS, approval: rules.APPROVAL_REQUIRED_FIELDS });
	res.status(200).json({
		success: true,
		data: {
			appliesDirectly: req.user.role === "admin",
			client: policy(clientRules),
			property: policy(propertyRules),
		},
	});
});

module.exports = router;

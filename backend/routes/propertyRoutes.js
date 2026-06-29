const express = require("express");
const router = express.Router();
const {
	createProperty,
	getProperties,
	getPropertyById,
	deleteProperty,
} = require("../controllers/propertyController");
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");
const logActivity = require("../middleware/logActivity");

// Create property (any authenticated user)
router.post(
	"/",
	verifyToken,
	logActivity(
		(req, data) => `Created property ${data?.data?.propertyCode || req.body.title || "property"}`,
		"property",
		(req, data) => data?.data?._id,
	),
	createProperty,
);

// Get all properties with filters
router.get("/", verifyToken, getProperties);

// Get property by ID
router.get("/:id", verifyToken, getPropertyById);

// Delete property (admin only)
router.delete("/:id", verifyToken, requireAdmin, deleteProperty);

module.exports = router;

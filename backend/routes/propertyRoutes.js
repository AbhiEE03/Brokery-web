const express = require("express");
const router = express.Router();
const {
	createProperty,
	getProperties,
	getPropertyById,
	updateProperty,
	deleteProperty,
	addPropertyImage,
} = require("../controllers/propertyController");
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");
const { uploadImage } = require("../middleware/uploadMiddleware");
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

// Upload property image
router.post("/:id/images", verifyToken, uploadImage.single("file"), addPropertyImage);

// Update property with direct edit vs approval workflow
router.patch(
	"/:id",
	verifyToken,
	logActivity(
		(req) => `Updated property ${req.params.id}`,
		"property",
		(req) => req.params.id,
	),
	updateProperty,
);

// Delete property (admin only)
router.delete("/:id", verifyToken, requireAdmin, deleteProperty);

module.exports = router;

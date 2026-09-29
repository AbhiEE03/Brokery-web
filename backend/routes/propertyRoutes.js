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
const Property = require("../models/Property");
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");
const { loadResource, authorize } = require("../middleware/resourceMiddleware");
const { validate } = require("../middleware/validate");
const { uploadImage } = require("../middleware/uploadMiddleware");
const logActivity = require("../middleware/logActivity");
const {
	createPropertyBody,
	updatePropertyBody,
	listPropertiesQuery,
} = require("../validation/schemas");

const loadProperty = loadResource(Property, "property", {
	populate: { path: "addedBy", select: "name email" },
});

router.use(verifyToken);

// Create property (any authenticated user)
router.post(
	"/",
	validate({ body: createPropertyBody }),
	logActivity(
		(req, data) => `Created property ${data?.data?.propertyCode || req.body.title || "property"}`,
		"property",
		(req, data) => data?.data?._id,
	),
	createProperty,
);

// Get all properties with filters (inventory is shared across brokers)
router.get("/", validate({ query: listPropertiesQuery }), getProperties);

// Get property by ID
router.get("/:id", loadProperty, authorize("read"), getPropertyById);

// Upload property image — authorization runs before the file is stored
router.post(
	"/:id/images",
	loadProperty,
	authorize("upload"),
	uploadImage.single("file"),
	addPropertyImage,
);

// Update property with direct edit vs approval workflow
router.patch(
	"/:id",
	loadProperty,
	authorize("update"),
	validate({ body: updatePropertyBody }),
	logActivity(
		(req) => `Updated property ${req.resource?.propertyCode || req.params.id}`,
		"property",
		(req) => req.params.id,
	),
	updateProperty,
);

// Delete property (admin only)
router.delete("/:id", requireAdmin, loadProperty, deleteProperty);

module.exports = router;

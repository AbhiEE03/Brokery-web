const express = require("express");
const router = express.Router();
const {
	createClient,
	getClients,
	getClientById,
	updateClient,
	deleteClient,
	addClientDocument,
} = require("../controllers/clientController");
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");
const { uploadDocument } = require("../middleware/uploadMiddleware");
const logActivity = require("../middleware/logActivity");

// Create client (admin or broker)
router.post(
	"/",
	verifyToken,
	logActivity(
		(req, data) => `Created client ${data?.data?.name || req.body.name || "client"}`,
		"client",
		(req, data) => data?.data?._id,
	),
	createClient,
);

// Get all clients with filters and pagination
router.get("/", verifyToken, getClients);

// Get client by ID
router.get("/:id", verifyToken, getClientById);

// Upload client document
router.post("/:id/documents", verifyToken, uploadDocument.single("file"), addClientDocument);

// Update client (direct edits immediately, sensitive edits via change request)
router.patch(
	"/:id",
	verifyToken,
	logActivity(
		(req) => `Updated client ${req.params.id}`,
		"client",
		(req) => req.params.id,
	),
	updateClient,
);

// Delete client (admin only)
router.delete("/:id", verifyToken, requireAdmin, deleteClient);

module.exports = router;

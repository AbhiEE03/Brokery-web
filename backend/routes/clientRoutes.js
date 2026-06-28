const express = require("express");
const router = express.Router();
const {
	createClient,
	getClients,
	getClientById,
	updateClient,
	deleteClient,
} = require("../controllers/clientController");
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");

// Create client (admin or broker)
router.post("/", verifyToken, createClient);

// Get all clients with filters and pagination
router.get("/", verifyToken, getClients);

// Get client by ID
router.get("/:id", verifyToken, getClientById);

// Update client (direct edits immediately, sensitive edits via change request)
router.patch("/:id", verifyToken, updateClient);

// Delete client (admin only)
router.delete("/:id", verifyToken, requireAdmin, deleteClient);

module.exports = router;

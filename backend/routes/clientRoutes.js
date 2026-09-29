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
const Client = require("../models/Client");
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");
const { loadResource, authorize } = require("../middleware/resourceMiddleware");
const { validate } = require("../middleware/validate");
const { uploadDocument } = require("../middleware/uploadMiddleware");
const {
	createClientBody,
	updateClientBody,
	listClientsQuery,
} = require("../validation/schemas");

const loadClient = loadResource(Client, "client", {
	populate: { path: "assignedBroker", select: "name email" },
});

router.use(verifyToken);

// Create client (admin or broker)
router.post(
	"/",
	validate({ body: createClientBody }),
	createClient,
);

// Get all clients with filters and pagination
router.get("/", validate({ query: listClientsQuery }), getClients);

// Get client by ID
router.get("/:id", loadClient, authorize("read"), getClientById);

// Upload client document — authorization runs before the file is stored
router.post(
	"/:id/documents",
	loadClient,
	authorize("upload"),
	uploadDocument.single("file"),
	addClientDocument,
);

// Update client (direct edits immediately, sensitive edits via change request)
router.patch(
	"/:id",
	loadClient,
	authorize("update"),
	validate({ body: updateClientBody }),
	updateClient,
);

// Delete client (admin only)
router.delete("/:id", requireAdmin, loadClient, deleteClient);

module.exports = router;

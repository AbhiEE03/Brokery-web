const express = require("express");
const router = express.Router();
const { listBrokers, createUser, setStatus, resetPassword, reassignClients } = require("../controllers/teamController");
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");
const { validate } = require("../middleware/validate");
const { idParams, listBrokersQuery, createUserBody, userStatusBody, reassignClientsBody } = require("../validation/schemas");

// Team management is admin-only.
router.use(verifyToken, requireAdmin);

router.get("/brokers", validate({ query: listBrokersQuery }), listBrokers);
router.post("/", validate({ body: createUserBody }), createUser);
router.patch("/:id/status", validate({ params: idParams, body: userStatusBody }), setStatus);
router.post("/:id/reset-password", validate({ params: idParams }), resetPassword);
router.post("/:id/reassign-clients", validate({ params: idParams, body: reassignClientsBody }), reassignClients);

module.exports = router;

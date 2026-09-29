const express = require("express");
const router = express.Router();
const { register, login, getMe, getBrokers } = require("../controllers/authController");
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");
const { validate } = require("../middleware/validate");
const { loginBody, registerBody } = require("../validation/schemas");

router.post("/register", verifyToken, requireAdmin, validate({ body: registerBody }), register);
router.post("/login", validate({ body: loginBody }), login);
router.get("/me", verifyToken, getMe);
router.get("/brokers", verifyToken, requireAdmin, getBrokers);

module.exports = router;

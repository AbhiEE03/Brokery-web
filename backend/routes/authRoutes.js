const express = require("express");
const router = express.Router();
const { register, login, getMe } = require("../controllers/authController");
const { verifyToken, requireAdmin } = require("../middleware/authMiddleware");

router.post("/register", verifyToken, requireAdmin, register);
router.post("/login", login);
router.get("/me", verifyToken, getMe);

module.exports = router;

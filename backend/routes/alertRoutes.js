const express = require("express");
const router = express.Router();
const { getAlerts, markRead, markAllRead } = require("../controllers/alertController");
const { verifyToken } = require("../middleware/authMiddleware");
const { validate } = require("../middleware/validate");
const { idParams, listAlertsQuery } = require("../validation/schemas");

router.use(verifyToken);

router.get("/", validate({ query: listAlertsQuery }), getAlerts);
router.post("/read-all", markAllRead);
router.post("/:id/read", validate({ params: idParams }), markRead);

module.exports = router;

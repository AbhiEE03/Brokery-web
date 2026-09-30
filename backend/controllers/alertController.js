const Alert = require("../models/Alert");
const { HttpError } = require("../utils/httpError");

// GET /api/alerts?unread=1&limit=20 — the signed-in user's alerts, newest first.
exports.getAlerts = async (req, res) => {
	const { unread, limit } = req.validated.query;
	const filter = { user: req.user._id, ...(unread ? { readAt: null } : {}) };
	const [alerts, unreadCount] = await Promise.all([
		Alert.find(filter).sort({ createdAt: -1 }).limit(limit).lean(),
		Alert.countDocuments({ user: req.user._id, readAt: null }),
	]);
	res.status(200).json({ success: true, data: alerts, meta: { unreadCount } });
};

// POST /api/alerts/:id/read — only your own alerts.
exports.markRead = async (req, res) => {
	const alert = await Alert.findOneAndUpdate(
		{ _id: req.validated.params.id, user: req.user._id },
		{ $set: { readAt: new Date() } },
		{ returnDocument: "after" },
	);
	if (!alert) throw new HttpError(404, "Alert not found");
	res.status(200).json({ success: true, data: alert });
};

// POST /api/alerts/read-all
exports.markAllRead = async (req, res) => {
	const result = await Alert.updateMany({ user: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
	res.status(200).json({ success: true, data: { updated: result.modifiedCount } });
};

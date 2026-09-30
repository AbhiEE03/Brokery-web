const shortlists = require("../services/shortlistService");

const publicUrl = (token) => `${(process.env.CLIENT_URL || "").replace(/\/$/, "")}/s/${token}`;

// POST /api/clients/:id/shortlists { propertyIds, expiresInDays }
exports.createShortlist = async (req, res) => {
	const { link, token } = await shortlists.createLink({
		client: req.resource,
		propertyIds: req.body.propertyIds,
		expiresInDays: req.body.expiresInDays,
		actor: req.user,
	});
	res.status(201).json({
		success: true,
		message: "Shortlist link created. Copy it now: it can't be shown again.",
		data: { _id: link._id, url: publicUrl(token), expiresAt: link.expiresAt, properties: link.properties },
	});
};

// GET /api/clients/:id/shortlists
exports.listShortlists = async (req, res) => {
	res.status(200).json({ success: true, data: await shortlists.listForClient(req.resource._id) });
};

// DELETE /api/shortlists/:id
exports.revokeShortlist = async (req, res) => {
	const link = await shortlists.revokeLink({ linkId: req.validated.params.id, actor: req.user });
	res.status(200).json({ success: true, message: "Link revoked", data: { _id: link._id, revokedAt: link.revokedAt } });
};

// GET /api/public/shortlists/:token (no login)
exports.viewPublicShortlist = async (req, res) => {
	res.set("Cache-Control", "no-store");
	res.set("X-Robots-Tag", "noindex, nofollow");
	res.status(200).json({ success: true, data: await shortlists.publicView(req.params.token) });
};

// POST /api/public/shortlists/:token/feedback (no login)
exports.submitPublicFeedback = async (req, res) => {
	const outcome = await shortlists.recordFeedback({ token: req.params.token, ...req.body });
	res.set("Cache-Control", "no-store");
	res.status(200).json({
		success: true,
		message: outcome.changed ? "Thanks! Your broker has been told." : "Already noted.",
		data: outcome,
	});
};

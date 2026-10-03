const team = require("../services/teamService");

// GET /api/users/brokers?includeInactive=1
exports.listBrokers = async (req, res) => {
	res.status(200).json({ success: true, data: await team.listBrokers(req.validated.query) });
};

// POST /api/users
exports.createUser = async (req, res) => {
	const { user, generatedPassword } = await team.createUser({ ...req.body, actor: req.user });
	res.status(201).json({
		success: true,
		message: generatedPassword ? "Account created. Share the password now: it won't be shown again." : "Account created",
		data: { user, ...(generatedPassword ? { generatedPassword } : {}) },
	});
};

// PATCH /api/users/:id/status { isActive }
exports.setStatus = async (req, res) => {
	const user = await team.setStatus({ userId: req.validated.params.id, isActive: req.body.isActive, actor: req.user });
	res.status(200).json({
		success: true,
		message: user.isActive ? "Account reactivated" : "Account deactivated. They are signed out immediately.",
		data: user,
	});
};

// POST /api/users/:id/reset-password
exports.resetPassword = async (req, res) => {
	const { user, temporaryPassword } = await team.resetPassword({ userId: req.validated.params.id, actor: req.user });
	res.status(200).json({
		success: true,
		message: "Password reset and all sessions signed out. Share the new password now: it won't be shown again.",
		data: { user, temporaryPassword },
	});
};

// POST /api/users/:id/reassign-clients { toBrokerId }
exports.reassignClients = async (req, res) => {
	const result = await team.reassignClients({ fromId: req.validated.params.id, toBrokerId: req.body.toBrokerId, actor: req.user });
	res.status(200).json({ success: true, message: `Moved ${result.moved} client${result.moved === 1 ? "" : "s"} to ${result.to.name}`, data: result });
};

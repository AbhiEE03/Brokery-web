const Client = require("../models/Client");
const ClientChangeRequest = require("../models/ClientChangeRequest");

const getValueByPath = (source, path) => {
	return path.split(".").reduce((current, key) => current?.[key], source);
};

const setValueByPath = (source, path, value) => {
	const keys = path.split(".");
	const lastKey = keys.pop();
	const target = keys.reduce((current, key) => {
		if (!current[key]) current[key] = {};
		return current[key];
	}, source);
	target[lastKey] = value;
	return source;
};

exports.getChangeRequests = async (req, res) => {
	try {
		const query = req.user.role === "broker"
			? { requestedBy: req.user._id }
			: {};

		const changeRequests = await ClientChangeRequest.find(query)
			.sort({ createdAt: -1 })
			.populate("client", "name clientCode")
			.populate("requestedBy", "name email")
			.lean();

		res.status(200).json({
			success: true,
			data: changeRequests,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

exports.getChangeRequestById = async (req, res) => {
	try {
		const changeRequest = await ClientChangeRequest.findById(req.params.id)
			.populate("client", "name clientCode")
			.populate("requestedBy", "name email")
			.lean();

		if (!changeRequest) {
			return res.status(404).json({
				success: false,
				message: "Change request not found",
			});
		}

		if (
			req.user.role === "broker" &&
			changeRequest.requestedBy?._id?.toString() !== req.user._id.toString()
		) {
			return res.status(403).json({
				success: false,
				message: "You are not authorized to view this change request",
			});
		}

		res.status(200).json({
			success: true,
			data: changeRequest,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

exports.resolveChangeRequest = async (req, res) => {
	try {
		const { action, adminNote } = req.body;

		if (!["approved", "rejected"].includes(action)) {
			return res.status(400).json({
				success: false,
				message: "Action must be approved or rejected",
			});
		}

		const changeRequest = await ClientChangeRequest.findById(req.params.id);

		if (!changeRequest) {
			return res.status(404).json({
				success: false,
				message: "Change request not found",
			});
		}

		if (changeRequest.status !== "pending") {
			return res.status(400).json({
				success: false,
				message: "This change request has already been resolved",
			});
		}

		if (action === "approved") {
			const client = await Client.findById(changeRequest.client);
			if (client) {
				for (const change of changeRequest.changes) {
					setValueByPath(client, change.field, change.newValue);
				}
				client.updatedAt = Date.now();
				await client.save();
			}
		}

		changeRequest.status = action;
		changeRequest.adminNote = adminNote || changeRequest.adminNote;
		changeRequest.resolvedBy = req.user._id;
		changeRequest.resolvedAt = Date.now();
		await changeRequest.save();

		res.status(200).json({
			success: true,
			message: `Change request ${action}`,
			data: changeRequest,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

const Client = require("../models/Client");
const ClientChangeRequest = require("../models/ClientChangeRequest");
const {
	DIRECT_EDIT_FIELDS,
	APPROVAL_REQUIRED_FIELDS,
} = require("../utils/clientEditRules");

// Generate the next client code in the format CL-000001
const generateNextClientCode = async () => {
	const lastClient = await Client.findOne({}, { clientCode: 1 })
		.sort({ clientCode: -1 })
		.lean();

	if (!lastClient || !lastClient.clientCode) return "CL-000001";

	const currentNumber = parseInt(lastClient.clientCode.split("-")[1], 10);
	return `CL-${String(currentNumber + 1).padStart(6, "0")}`;
};

const flattenPayload = (value, prefix = "") => {
	const entries = [];

	if (value && typeof value === "object" && !Array.isArray(value)) {
		for (const [key, childValue] of Object.entries(value)) {
			const nextKey = prefix ? `${prefix}.${key}` : key;

			if (childValue && typeof childValue === "object" && !Array.isArray(childValue)) {
				entries.push(...flattenPayload(childValue, nextKey));
			} else {
				entries.push([nextKey, childValue]);
			}
		}
	}

	return entries;
};

const getValueByPath = (source, path) => {
	return path.split(".").reduce((current, key) => current?.[key], source);
};

// Create a new client and auto-generate a clientCode
exports.createClient = async (req, res) => {
	try {
		const clientCode = await generateNextClientCode();

		const clientPayload = {
			...req.body,
			clientCode,
		};

		// Brokers can only create clients assigned to themselves
		if (req.user.role === "broker") {
			clientPayload.assignedBroker = req.user._id;
		}

		const client = await Client.create(clientPayload);

		res.status(201).json({
			success: true,
			message: "Client created successfully",
			data: client,
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			message: error.message,
		});
	}
};

// Get clients with role-based visibility, filters, and pagination
exports.getClients = async (req, res) => {
	try {
		const { stage, city, broker, search, page = 1, limit = 20 } = req.query;

		const query = {};

		// Brokers only see their own clients; admins can see all or filter by broker
		if (req.user.role === "broker") {
			query.assignedBroker = req.user._id;
		} else if (broker) {
			query.assignedBroker = broker;
		}

		if (stage) query.pipelineStage = stage;
		if (city) query["requirements.city"] = city;
		if (search) {
			query.name = { $regex: search, $options: "i" };
		}

		const skip = (Number(page) - 1) * Number(limit);
		const clients = await Client.find(query)
			.skip(skip)
			.limit(Number(limit))
			.sort({ createdAt: -1 })
			.populate("assignedBroker", "name email")
			.lean();

		const total = await Client.countDocuments(query);

		res.status(200).json({
			success: true,
			data: clients,
			pagination: {
				page: Number(page),
				limit: Number(limit),
				total,
				pages: Math.ceil(total / Number(limit)),
			},
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

// Get a single client by ID, with broker access restriction
exports.getClientById = async (req, res) => {
	try {
		const client = await Client.findById(req.params.id).populate(
			"assignedBroker",
			"name email",
		);

		if (!client) {
			return res.status(404).json({
				success: false,
				message: "Client not found",
			});
		}

		if (
			req.user.role === "broker" &&
			client.assignedBroker?._id?.toString() !== req.user._id.toString()
		) {
			return res.status(403).json({
				success: false,
				message: "You are not authorized to view this client",
			});
		}

		res.status(200).json({
			success: true,
			data: client,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

// Apply direct edits immediately and queue sensitive ones for admin approval
exports.updateClient = async (req, res) => {
	try {
		const client = await Client.findById(req.params.id);

		if (!client) {
			return res.status(404).json({
				success: false,
				message: "Client not found",
			});
		}

		if (
			req.user.role === "broker" &&
			client.assignedBroker?.toString() !== req.user._id.toString()
		) {
			return res.status(403).json({
				success: false,
				message: "You are not authorized to update this client",
			});
		}

		const flatFields = flattenPayload(req.body);
		const directFields = {};
		const sensitiveFields = {};

		for (const [field, value] of flatFields) {
			if (DIRECT_EDIT_FIELDS.includes(field)) {
				directFields[field] = value;
			} else if (APPROVAL_REQUIRED_FIELDS.includes(field)) {
				sensitiveFields[field] = value;
			}
		}

		if (
			Object.keys(directFields).length === 0 &&
			Object.keys(sensitiveFields).length === 0
		) {
			return res.status(400).json({
				success: false,
				message: "No supported client fields were provided",
			});
		}

		let updatedClient = null;
		let pendingChangeRequest = null;

		if (Object.keys(directFields).length > 0) {
			updatedClient = await Client.findByIdAndUpdate(
				req.params.id,
				{ $set: directFields },
				{ new: true },
			);
		}

		if (Object.keys(sensitiveFields).length > 0) {
			const currentClient = await Client.findById(req.params.id).lean();
			const changes = Object.entries(sensitiveFields).map(([field, newValue]) => ({
				field,
				oldValue: getValueByPath(currentClient, field),
				newValue,
			}));

			pendingChangeRequest = await ClientChangeRequest.create({
				client: req.params.id,
				requestedBy: req.user._id,
				changes,
			});
		}

		res.status(200).json({
			success: true,
			message: "Client update processed",
			data: {
				updated: updatedClient,
				pending: pendingChangeRequest,
			},
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

// Delete a client by ID (admin only)
exports.deleteClient = async (req, res) => {
	try {
		const client = await Client.findByIdAndDelete(req.params.id);

		if (!client) {
			return res.status(404).json({
				success: false,
				message: "Client not found",
			});
		}

		res.status(200).json({
			success: true,
			message: "Client deleted successfully",
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

exports.addClientDocument = async (req, res) => {
	try {
		const client = await Client.findById(req.params.id);

		if (!client) {
			return res.status(404).json({
				success: false,
				message: "Client not found",
			});
		}

		if (!req.file) {
			return res.status(400).json({
				success: false,
				message: "Document file is required",
			});
		}

		client.documents = client.documents || [];
		client.documents.push({
			name: req.file.originalname,
			url: req.file.path,
			type: req.body.type || "other",
			uploadedAt: new Date(),
		});

		await client.save();

		res.status(200).json({
			success: true,
			message: "Client document uploaded successfully",
			data: client,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

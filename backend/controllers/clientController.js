const Client = require("../models/Client");
const ClientChangeRequest = require("../models/ClientChangeRequest");
const {
	DIRECT_EDIT_FIELDS,
	APPROVAL_REQUIRED_FIELDS,
} = require("../utils/clientEditRules");
const { toSkip, paginationMeta } = require("../utils/pagination");
const { escapeRegex } = require("../utils/regex");

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

		// req.body is already whitelisted by createClientBody: pipelineStage,
		// codes and timestamps are server-controlled.
		const clientPayload = {
			...req.body,
			clientCode,
			pipelineStage: "lead",
		};

		// Brokers can only create clients assigned to themselves
		if (req.user.role !== "admin") {
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
		const { stage, city, broker, search, page, limit } = req.validated.query;

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
			query.name = { $regex: escapeRegex(search), $options: "i" };
		}

		const [clients, total] = await Promise.all([
			Client.find(query)
				.sort({ createdAt: -1 })
				.skip(toSkip({ page, limit }))
				.limit(limit)
				.populate("assignedBroker", "name email")
				.lean(),
			Client.countDocuments(query),
		]);

		res.status(200).json({
			success: true,
			data: clients,
			pagination: paginationMeta({ page, limit }, total),
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

// Get a single client by ID (loaded and authorized by route middleware)
exports.getClientById = async (req, res) => {
	res.status(200).json({
		success: true,
		data: req.resource,
	});
};

// Apply direct edits immediately and queue sensitive ones for admin approval
exports.updateClient = async (req, res) => {
	try {
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
		await req.resource.deleteOne();

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

const DOCUMENT_TYPES = ["id_proof", "income_proof", "agreement", "other"];

exports.addClientDocument = async (req, res) => {
	try {
		const client = req.resource;

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
			type: DOCUMENT_TYPES.includes(req.body?.type) ? req.body.type : "other",
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

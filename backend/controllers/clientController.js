const Client = require("../models/Client");
const { toSkip, paginationMeta } = require("../utils/pagination");
const { proposeChanges, describeProposal } = require("../services/approvalService");
const { escapeRegex } = require("../utils/regex");
const { HttpError } = require("../utils/httpError");
const lifecycle = require("../services/lifecycleService");
const audit = require("../services/auditService");
const mongoose = require("mongoose");

// Create a new client and auto-generate a clientCode
exports.createClient = async (req, res) => {
	// req.body is already whitelisted by createClientBody: pipelineStage,
	// codes and timestamps are server-controlled.
	const data = { ...req.body };

	// Brokers can only create clients assigned to themselves
	if (req.user.role !== "admin") {
		data.assignedBroker = req.user._id;
	}

	const client = await lifecycle.createClient({ data, actor: req.user });

	res.status(201).json({
		success: true,
		message: "Client created successfully",
		data: client,
	});
};

// Get clients with role-based visibility, filters, and pagination
exports.getClients = async (req, res) => {
	const { stage, city, broker, search, page, limit } = req.validated.query;

	const query = {};

	// Brokers only see their own clients; admins can see all or filter by broker
	if (req.user.role === "broker") {
		query.assignedBroker = req.user._id;
	} else if (broker) {
		query.assignedBroker = broker;
	}

	if (stage) query.pipelineStage = stage;
	if (city) query["requirements.cityKey"] = city.trim().toLowerCase();
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
};

// Get a single client by ID (loaded and authorized by route middleware)
exports.getClientById = async (req, res) => {
	res.status(200).json({
		success: true,
		data: req.resource,
	});
};

// Direct fields apply now; sensitive fields become a change request (see services/approvalService.js)
exports.updateClient = async (req, res) => {
	const result = await proposeChanges({
		entityType: "client",
		entityId: req.resource._id,
		patch: req.body,
		actor: req.user,
	});
	await result.entity.populate({ path: "assignedBroker", select: "name email" });

	res.status(result.pending && result.applied.length === 0 ? 202 : 200).json({
		success: true,
		message: describeProposal(result),
		data: {
			updated: result.entity,
			pending: result.pending,
			applied: result.applied,
			unchanged: result.unchanged,
			superseded: result.superseded,
		},
	});
};

// Delete a client by ID (admin only)
exports.deleteClient = async (req, res) => {
	await lifecycle.softDeleteEntity({
		entityType: "client",
		entity: req.resource,
		actor: req.user,
	});

	res.status(200).json({
		success: true,
		message: "Client deleted successfully",
	});
};

const DOCUMENT_TYPES = ["id_proof", "income_proof", "agreement", "other"];

exports.addClientDocument = async (req, res) => {
	const client = req.resource;

	if (!req.file) {
		throw new HttpError(400, "Document file is required", { code: "FILE_REQUIRED" });
	}

	const document = {
		name: req.file.originalname,
		url: req.file.path,
		type: DOCUMENT_TYPES.includes(req.body?.type) ? req.body.type : "other",
		uploadedAt: new Date(),
	};
	client.documents = client.documents || [];
	client.documents.push(document);

	await mongoose.connection.transaction(async (session) => {
		await client.save({ session });
		await audit.record(
			{
				actor: req.user._id,
				action: "client.document_upload",
				entityType: "client",
				entityId: client._id,
				summary: `Uploaded ${document.type.replace("_", " ")} "${document.name}" for client ${client.name}`,
				after: document,
			},
			{ session },
		);
	});

	res.status(200).json({
		success: true,
		message: "Client document uploaded successfully",
		data: client,
	});
};

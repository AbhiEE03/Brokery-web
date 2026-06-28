const Client = require("../models/Client");

// Generate the next client code in the format CL-000001
const generateNextClientCode = async () => {
	const lastClient = await Client.findOne({}, { clientCode: 1 })
		.sort({ clientCode: -1 })
		.lean();

	if (!lastClient || !lastClient.clientCode) return "CL-000001";

	const currentNumber = parseInt(lastClient.clientCode.split("-")[1], 10);
	return `CL-${String(currentNumber + 1).padStart(6, "0")}`;
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

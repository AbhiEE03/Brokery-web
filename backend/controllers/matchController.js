const Match = require("../models/Match");
const Client = require("../models/Client");
const Property = require("../models/Property");
const { can, isAdmin } = require("../policies");

const CLIENT_FIELDS = "name clientCode phone email assignedBroker";
const PROPERTY_FIELDS = "title propertyCode location pricing status";

// Brokers see matches they created or that involve their own clients.
const visibilityFilter = async (user) => {
	if (isAdmin(user)) return {};
	const ownClientIds = await Client.find({ assignedBroker: user._id }).distinct("_id");
	return { $or: [{ createdBy: user._id }, { client: { $in: ownClientIds } }] };
};

exports.getMatches = async (req, res) => {
	try {
		const matches = await Match.find(await visibilityFilter(req.user))
			.populate("client", CLIENT_FIELDS)
			.populate("property", PROPERTY_FIELDS)
			.populate("createdBy", "name email role")
			.sort({ createdAt: -1 })
			.lean();

		res.status(200).json({
			success: true,
			data: matches,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

exports.createMatch = async (req, res) => {
	try {
		const { client, property, interestLevel, notes } = req.body;

		const [clientDoc, propertyExists] = await Promise.all([
			Client.findById(client),
			Property.exists({ _id: property }),
		]);

		if (!clientDoc || !propertyExists) {
			return res.status(404).json({
				success: false,
				message: "Client or property not found",
			});
		}

		if (!can(req.user, "link", "client", clientDoc)) {
			return res.status(403).json({
				success: false,
				message: "You can only link your own clients",
			});
		}

		const existingMatch = await Match.exists({ client, property });
		if (existingMatch) {
			return res.status(409).json({
				success: false,
				message: "This client-property match already exists",
			});
		}

		const match = await Match.create({
			client,
			property,
			interestLevel,
			notes,
			createdBy: req.user._id,
		});

		res.status(201).json({
			success: true,
			message: "Match created successfully",
			data: match,
		});
	} catch (error) {
		// Unique index on (client, property) catches concurrent duplicates.
		if (error.code === 11000) {
			return res.status(409).json({
				success: false,
				message: "This client-property match already exists",
			});
		}
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

// Route middleware has already loaded req.resource (client) and authorized "read".
exports.getMatchesByClient = async (req, res) => {
	try {
		const matches = await Match.find({ client: req.resource._id })
			.populate("property", PROPERTY_FIELDS)
			.sort({ createdAt: -1 })
			.lean();

		res.status(200).json({
			success: true,
			data: matches,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

// Property inventory is shared, but the client links on it are scoped per broker.
exports.getMatchesByProperty = async (req, res) => {
	try {
		const filter = {
			property: req.resource._id,
			...(await visibilityFilter(req.user)),
		};

		const matches = await Match.find(filter)
			.populate("client", CLIENT_FIELDS)
			.sort({ createdAt: -1 })
			.lean();

		res.status(200).json({
			success: true,
			data: matches,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

exports.updateMatch = async (req, res) => {
	try {
		const match = req.resource;

		if (req.body.interestLevel) {
			match.interestLevel = req.body.interestLevel;
		}
		if (req.body.notes !== undefined) {
			match.notes = req.body.notes;
		}

		await match.save();

		res.status(200).json({
			success: true,
			message: "Match updated successfully",
			data: match,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

exports.deleteMatch = async (req, res) => {
	try {
		await req.resource.deleteOne();

		res.status(200).json({
			success: true,
			message: "Match deleted successfully",
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

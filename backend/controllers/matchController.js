const Match = require("../models/Match");
const Client = require("../models/Client");
const Property = require("../models/Property");

exports.getMatches = async (req, res) => {
	try {
		const query = req.user.role === "broker" ? { createdBy: req.user._id } : {};

		const matches = await Match.find(query)
			.populate("client", "name clientCode phone email")
			.populate("property", "title propertyCode location pricing status")
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

		if (!client || !property || !interestLevel) {
			return res.status(400).json({
				success: false,
				message: "client, property, and interestLevel are required",
			});
		}

		const [clientExists, propertyExists] = await Promise.all([
			Client.findById(client),
			Property.findById(property),
		]);

		if (!clientExists || !propertyExists) {
			return res.status(404).json({
				success: false,
				message: "Client or property not found",
			});
		}

		const existingMatch = await Match.findOne({ client, property });
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
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

exports.getMatchesByClient = async (req, res) => {
	try {
		const matches = await Match.find({ client: req.params.clientId })
			.populate("property", "title propertyCode location pricing status")
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

exports.getMatchesByProperty = async (req, res) => {
	try {
		const matches = await Match.find({ property: req.params.propertyId })
			.populate("client", "name clientCode phone email")
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
		const match = await Match.findById(req.params.id);

		if (!match) {
			return res.status(404).json({
				success: false,
				message: "Match not found",
			});
		}

		if (
			req.user.role !== "admin" &&
			match.createdBy?.toString() !== req.user._id.toString()
		) {
			return res.status(403).json({
				success: false,
				message: "You are not authorized to update this match",
			});
		}

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
		const match = await Match.findById(req.params.id);

		if (!match) {
			return res.status(404).json({
				success: false,
				message: "Match not found",
			});
		}

		if (
			req.user.role !== "admin" &&
			match.createdBy?.toString() !== req.user._id.toString()
		) {
			return res.status(403).json({
				success: false,
				message: "You are not authorized to delete this match",
			});
		}

		await Match.findByIdAndDelete(req.params.id);

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

const Property = require("../models/Property");
const { generateNextCode } = require("../utils/codeGenerator");

// Create a new property with auto-generated propertyCode
exports.createProperty = async (req, res) => {
	try {
		const propertyCode = await generateNextCode(Property);

		const property = await Property.create({
			...req.body,
			propertyCode,
			addedBy: req.user._id,
		});

		res.status(201).json({
			success: true,
			message: "Property created successfully",
			data: property,
		});
	} catch (error) {
		res.status(400).json({
			success: false,
			message: error.message,
		});
	}
};

// Get all properties with filters and pagination
exports.getProperties = async (req, res) => {
	try {
		const {
			city,
			type,
			status,
			minPrice,
			maxPrice,
			minArea,
			page = 1,
			limit = 20,
			search,
		} = req.query;

		// Build query object
		const query = {};
		if (city) query["location.city"] = city;
		if (type) query.propertyType = type;
		if (status) query.status = status;

		// Price range filter
		if (minPrice || maxPrice) {
			query["pricing.askingPrice"] = {};
			if (minPrice) query["pricing.askingPrice"].$gte = Number(minPrice);
			if (maxPrice) query["pricing.askingPrice"].$lte = Number(maxPrice);
		}

		// Area range filter
		if (minArea) query["specs.area"] = { $gte: Number(minArea) };

		// Execute query with pagination
		const skip = (Number(page) - 1) * Number(limit);
		const properties = await Property.find(query)
			.skip(skip)
			.limit(Number(limit))
			.populate("addedBy", "name email")
			.lean();

		// Get total count for pagination metadata
		const total = await Property.countDocuments(query);

		res.status(200).json({
			success: true,
			data: properties,
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

// Get single property by ID
exports.getPropertyById = async (req, res) => {
	try {
		const property = await Property.findById(req.params.id).populate(
			"addedBy",
			"name email",
		);

		if (!property) {
			return res.status(404).json({
				success: false,
				message: "Property not found",
			});
		}

		res.status(200).json({
			success: true,
			data: property,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

// Delete property (admin only)
exports.deleteProperty = async (req, res) => {
	try {
		const property = await Property.findByIdAndDelete(req.params.id);

		if (!property) {
			return res.status(404).json({
				success: false,
				message: "Property not found",
			});
		}

		res.status(200).json({
			success: true,
			message: "Property deleted successfully",
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

const Property = require("../models/Property");
const PropertyChangeRequest = require("../models/PropertyChangeRequest");
const { generateNextCode } = require("../utils/codeGenerator");
const {
	DIRECT_EDIT_FIELDS,
	APPROVAL_REQUIRED_FIELDS,
} = require("../utils/propertyEditRules");

const flattenPayload = (value, prefix = "") => {
	const entries = [];

	if (value && typeof value === "object" && !Array.isArray(value)) {
		for (const [key, childValue] of Object.entries(value)) {
			const nextKey = prefix ? `${prefix}.${key}` : key;

			if (
				childValue &&
				typeof childValue === "object" &&
				!Array.isArray(childValue)
			) {
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

// Apply direct property edits immediately and queue sensitive ones for admin approval
exports.updateProperty = async (req, res) => {
	try {
		const property = await Property.findById(req.params.id);

		if (!property) {
			return res.status(404).json({
				success: false,
				message: "Property not found",
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
				message: "No supported property fields were provided",
			});
		}

		let updatedProperty = null;
		let pendingChangeRequest = null;

		if (Object.keys(directFields).length > 0) {
			updatedProperty = await Property.findByIdAndUpdate(
				req.params.id,
				{ $set: directFields },
				{ new: true },
			);
		}

		if (Object.keys(sensitiveFields).length > 0) {
			const currentProperty = await Property.findById(req.params.id).lean();
			const changes = Object.entries(sensitiveFields).map(([field, newValue]) => ({
				field,
				oldValue: getValueByPath(currentProperty, field),
				newValue,
			}));

			pendingChangeRequest = await PropertyChangeRequest.create({
				property: req.params.id,
				requestedBy: req.user._id,
				changes,
			});
		}

		res.status(200).json({
			success: true,
			message: "Property update processed",
			data: {
				updated: updatedProperty,
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

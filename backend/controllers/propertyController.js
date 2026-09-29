const Property = require("../models/Property");
const PropertyChangeRequest = require("../models/PropertyChangeRequest");
const { generateNextCode } = require("../utils/codeGenerator");
const {
	DIRECT_EDIT_FIELDS,
	APPROVAL_REQUIRED_FIELDS,
} = require("../utils/propertyEditRules");
const { toSkip, paginationMeta } = require("../utils/pagination");
const { escapeRegex } = require("../utils/regex");

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

		// req.body is whitelisted by createPropertyBody; status is server-controlled.
		const property = await Property.create({
			...req.body,
			propertyCode,
			status: "available",
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
		const { city, type, status, minPrice, maxPrice, minArea, page, limit, search } =
			req.validated.query;

		// Build query object
		const query = {};
		if (city) query["location.city"] = city;
		if (type) query.propertyType = type;
		if (status) query.status = status;

		// Price range filter
		if (minPrice !== undefined || maxPrice !== undefined) {
			query["pricing.askingPrice"] = {};
			if (minPrice !== undefined) query["pricing.askingPrice"].$gte = minPrice;
			if (maxPrice !== undefined) query["pricing.askingPrice"].$lte = maxPrice;
		}

		// Area range filter
		if (minArea !== undefined) query["specs.area"] = { $gte: minArea };

		// Free-text search on title, locality and code
		if (search) {
			const pattern = { $regex: escapeRegex(search), $options: "i" };
			query.$or = [
				{ title: pattern },
				{ "location.locality": pattern },
				{ propertyCode: pattern },
			];
		}

		const [properties, total] = await Promise.all([
			Property.find(query)
				.sort({ createdAt: -1, _id: -1 })
				.skip(toSkip({ page, limit }))
				.limit(limit)
				.populate("addedBy", "name email")
				.lean(),
			Property.countDocuments(query),
		]);

		res.status(200).json({
			success: true,
			data: properties,
			pagination: paginationMeta({ page, limit }, total),
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

// Get single property by ID (loaded and authorized by route middleware)
exports.getPropertyById = async (req, res) => {
	res.status(200).json({
		success: true,
		data: req.resource,
	});
};

// Apply direct property edits immediately and queue sensitive ones for admin approval
exports.updateProperty = async (req, res) => {
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
		await req.resource.deleteOne();

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

exports.addPropertyImage = async (req, res) => {
	try {
		const property = req.resource;

		if (!req.file) {
			return res.status(400).json({
				success: false,
				message: "Image file is required",
			});
		}

		property.images = property.images || [];
		property.images.push({
			url: req.file.path,
			uploadedAt: new Date(),
		});

		await property.save();

		res.status(200).json({
			success: true,
			message: "Property image uploaded successfully",
			data: property,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

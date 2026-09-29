const Property = require("../models/Property");
const { toSkip, paginationMeta } = require("../utils/pagination");
const { proposeChanges, describeProposal } = require("../services/approvalService");
const { escapeRegex } = require("../utils/regex");
const { HttpError } = require("../utils/httpError");
const lifecycle = require("../services/lifecycleService");

// Create a new property with auto-generated propertyCode
exports.createProperty = async (req, res) => {
	// req.body is whitelisted by createPropertyBody; status and code are server-controlled.
	const property = await lifecycle.createProperty({ data: req.body, actor: req.user });

	res.status(201).json({
		success: true,
		message: "Property created successfully",
		data: property,
	});
};

// Get all properties with filters and pagination
exports.getProperties = async (req, res) => {
	const { city, type, status, minPrice, maxPrice, minArea, page, limit, search } =
		req.validated.query;

	// Build query object
	const query = {};
	if (city) query["location.cityKey"] = city.trim().toLowerCase();
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
};

// Get single property by ID (loaded and authorized by route middleware)
exports.getPropertyById = async (req, res) => {
	res.status(200).json({
		success: true,
		data: req.resource,
	});
};

// Direct fields apply now; sensitive fields become a change request (see services/approvalService.js)
exports.updateProperty = async (req, res) => {
	const result = await proposeChanges({
		entityType: "property",
		entityId: req.resource._id,
		patch: req.body,
		actor: req.user,
	});
	await result.entity.populate({ path: "addedBy", select: "name email" });

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

// Delete property (admin only)
exports.deleteProperty = async (req, res) => {
	await lifecycle.softDeleteEntity({
		entityType: "property",
		entity: req.resource,
		actor: req.user,
	});

	res.status(200).json({
		success: true,
		message: "Property deleted successfully",
	});
};

exports.addPropertyImage = async (req, res) => {
	const property = req.resource;

	if (!req.file) {
		throw new HttpError(400, "Image file is required", { code: "FILE_REQUIRED" });
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
};

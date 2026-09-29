/**
 * Create / delete for clients and properties. Both run in a transaction so the
 * record, its code, its history and its dependants never get out of sync.
 */
const mongoose = require("mongoose");
const Client = require("../models/Client");
const Property = require("../models/Property");
const Match = require("../models/Match");
const ChangeRequest = require("../models/ChangeRequest");
const StageTransition = require("../models/StageTransition");
const { nextClientCode, nextPropertyCode } = require("../utils/codeGenerator");
const audit = require("./auditService");
const ownership = require("./ownershipService");
const { normalizeIndianMobile } = require("../utils/phone");

// Fields captured in the audit entry when a record is created.
const clientSnapshot = (c) => ({
	clientCode: c.clientCode,
	name: c.name,
	phone: c.phone,
	email: c.email ?? null,
	assignedBroker: c.assignedBroker?._id ?? c.assignedBroker ?? null,
	pipelineStage: c.pipelineStage,
	requirements: c.requirements?.toObject ? c.requirements.toObject() : c.requirements ?? null,
});

const propertySnapshot = (p) => ({
	propertyCode: p.propertyCode,
	title: p.title,
	propertyType: p.propertyType ?? null,
	status: p.status,
	location: p.location?.toObject ? p.location.toObject() : p.location ?? null,
	askingPrice: p.pricing?.askingPrice ?? null,
});

const createClient = async ({ data, actor }) => {
	const phoneKey = normalizeIndianMobile(data.phone);
	// Fast path: most duplicates are caught here. A simultaneous registration of
	// the same number slips past this check and is caught by the unique index below.
	if (phoneKey && (await Client.exists({ phoneKey }))) {
		await ownership.rejectDuplicate({ phoneKey, actor, data });
	}

	try {
		return await insertClient({ data, actor });
	} catch (error) {
		if (ownership.isPhoneKeyConflict(error)) await ownership.rejectDuplicate({ phoneKey, actor, data });
		throw error;
	}
};

const insertClient = async ({ data, actor }) => {
	let client;
	await mongoose.connection.transaction(async (session) => {
		const clientCode = await nextClientCode({ session });
		[client] = await Client.create(
			[{ ...data, clientCode, pipelineStage: "lead" }],
			{ session },
		);
		await StageTransition.create(
			[{ client: client._id, from: null, to: "lead", changedBy: actor._id, via: "create" }],
			{ session },
		);
		await audit.record(
			{
				actor: actor._id,
				action: "client.create",
				entityType: "client",
				entityId: client._id,
				summary: `Created client ${client.name} (${clientCode})`,
				after: clientSnapshot(client),
			},
			{ session },
		);
	});
	return client;
};

const createProperty = async ({ data, actor }) => {
	let property;
	await mongoose.connection.transaction(async (session) => {
		const propertyCode = await nextPropertyCode({ session });
		[property] = await Property.create(
			[{ ...data, propertyCode, status: "available", addedBy: actor._id }],
			{ session },
		);
		await audit.record(
			{
				actor: actor._id,
				action: "property.create",
				entityType: "property",
				entityId: property._id,
				summary: `Created property ${property.title} (${propertyCode})`,
				after: propertySnapshot(property),
			},
			{ session },
		);
	});
	return property;
};

// Soft delete keeps the record for audit; links to it are removed and any
// pending approvals for it are closed.
const softDeleteEntity = async ({ entityType, entity, actor }) => {
	const matchFilter = entityType === "client" ? { client: entity._id } : { property: entity._id };

	await mongoose.connection.transaction(async (session) => {
		entity.$session(session);
		await entity.softDelete(actor, { session });
		await Match.deleteMany(matchFilter, { session });
		await ChangeRequest.updateMany(
			{ entityType, entityId: entity._id, status: "pending" },
			{
				$set: {
					status: "withdrawn",
					resolvedAt: new Date(),
					adminNote: `${entityType} deleted`,
				},
			},
			{ session },
		);
		const label = entityType === "client" ? `${entity.name} (${entity.clientCode})` : `${entity.title} (${entity.propertyCode})`;
		await audit.record(
			{
				actor: actor._id,
				action: `${entityType}.delete`,
				entityType,
				entityId: entity._id,
				summary: `Deleted ${entityType} ${label}`,
				before: entityType === "client" ? clientSnapshot(entity) : propertySnapshot(entity),
			},
			{ session },
		);
	});
};

module.exports = { createClient, createProperty, softDeleteEntity, clientSnapshot, propertySnapshot };

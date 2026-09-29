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

const createClient = async ({ data, actor }) => {
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
	});
};

module.exports = { createClient, createProperty, softDeleteEntity };

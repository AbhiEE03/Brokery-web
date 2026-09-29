/**
 * Approval engine: one implementation of the "maker-checker" workflow for every
 * editable entity type.
 *
 * proposeChanges  → splits an edit into direct fields (applied now) and sensitive
 *                   fields (stored as a pending ChangeRequest); unchanged values are dropped.
 * resolveChangeRequest → atomically claims a pending request, re-checks that every
 *                   field still has the value the requester saw (stale detection),
 *                   applies it, and queues a notification — all in one transaction.
 *
 * Concurrency: every mutation bumps the entity's `revision`, so two transactions
 * touching the same record write-conflict and MongoDB retries one of them; the
 * status filter on the claim makes approval exactly-once.
 */
const mongoose = require("mongoose");
const Client = require("../models/Client");
const Property = require("../models/Property");
const User = require("../models/User");
const ChangeRequest = require("../models/ChangeRequest");
const Notification = require("../models/Notification");
const StageTransition = require("../models/StageTransition");
const clientRules = require("../utils/clientEditRules");
const propertyRules = require("../utils/propertyEditRules");
const { flattenPayload, normalizeValue, valuesEqual } = require("../utils/objectPath");
const { HttpError } = require("../utils/httpError");
const { isAdmin, sameId } = require("../policies");
const { dispatchSoon } = require("./notificationService");
const audit = require("./auditService");

const registry = {
	client: { Model: Client, rules: clientRules },
	property: { Model: Property, rules: propertyRules },
};

const getEntry = (entityType) => {
	const entry = registry[entityType];
	if (!entry) throw new HttpError(400, `Unknown entity type: ${entityType}`);
	return entry;
};

const classify = (rules, patch) => {
	const direct = {};
	const sensitive = {};
	const unsupported = [];

	for (const [field, value] of flattenPayload(patch)) {
		if (rules.DIRECT_EDIT_FIELDS.includes(field)) direct[field] = value;
		else if (rules.APPROVAL_REQUIRED_FIELDS.includes(field)) sensitive[field] = value;
		else unsupported.push(field);
	}

	return { direct, sensitive, unsupported };
};

// Only fields whose value actually changes become changes.
const diffAgainst = (entity, fields) =>
	Object.entries(fields)
		.filter(([field, value]) => !valuesEqual(entity.get(field), value))
		.map(([field, value]) => ({
			field,
			oldValue: normalizeValue(entity.get(field)),
			newValue: normalizeValue(value),
		}));

const applyChanges = (entity, changes) => {
	for (const { field, newValue } of changes) {
		entity.set(field, newValue);
	}
};

// Reference fields need an existence check that schema validation can't do.
const validateReferences = async (changes, session) => {
	const brokerChange = changes.find((c) => c.field === "assignedBroker");
	if (!brokerChange || brokerChange.newValue === null) return;

	const broker = await User.findOne({
		_id: brokerChange.newValue,
		role: "broker",
		isActive: true,
	}).session(session);

	if (!broker) {
		throw new HttpError(400, "assignedBroker must be an active broker", {
			code: "INVALID_BROKER",
		});
	}
};

// Pipeline history: one StageTransition per stage change, in the same transaction.
const recordStageTransitions = async ({ entityType, entity, changes, actor, via, session }) => {
	if (entityType !== "client") return;
	const stageChange = changes.find((c) => c.field === "pipelineStage");
	if (!stageChange) return;
	await StageTransition.create(
		[
			{
				client: entity._id,
				from: stageChange.oldValue,
				to: stageChange.newValue,
				changedBy: actor._id,
				via,
			},
		],
		{ session },
	);
};

const labelOf = (entityType, entity) => {
	if (!entity) return entityType;
	return entityType === "client" ?
			`${entity.name} (${entity.clientCode})`
		:	`${entity.title} (${entity.propertyCode})`;
};

const fieldList = (changes) => changes.map((c) => c.field).join(", ");

const bumpRevision = (Model, entityId, session) =>
	Model.updateOne({ _id: entityId }, { $inc: { revision: 1 } }, { session });

/**
 * @returns {{ entity, pending, applied: string[], unchanged: string[], superseded: ObjectId[] }}
 */
// Runs fn in the caller's transaction when one is given, otherwise in a new one.
const inTransaction = (session, fn) => (session ? fn(session) : mongoose.connection.transaction(fn));

const proposeChanges = async ({ entityType, entityId, patch, actor, session: outerSession }) => {
	const { Model, rules } = getEntry(entityType);
	const { direct, sensitive, unsupported } = classify(rules, patch);

	if (unsupported.length) {
		throw new HttpError(400, `These fields cannot be edited: ${unsupported.join(", ")}`, {
			code: "UNSUPPORTED_FIELDS",
			details: { fields: unsupported },
		});
	}

	// Admins are the approvers, so their edits apply directly (still audited).
	const actorIsAdmin = isAdmin(actor);
	let result;

	await inTransaction(outerSession, async (session) => {
		const entity = await Model.findById(entityId).session(session);
		if (!entity) throw new HttpError(404, `${Model.modelName} not found`);

		const directChanges = diffAgainst(entity, actorIsAdmin ? { ...direct, ...sensitive } : direct);
		const sensitiveChanges = actorIsAdmin ? [] : diffAgainst(entity, sensitive);
		const changedFields = new Set([...directChanges, ...sensitiveChanges].map((c) => c.field));
		const unchanged = [...Object.keys(direct), ...Object.keys(sensitive)].filter(
			(field) => !changedFields.has(field),
		);

		let pending = null;
		let reusedExisting = false;
		const superseded = [];

		// Fail fast: the proposal must produce a valid document once approved.
		if (sensitiveChanges.length) {
			const preview = Model.hydrate(entity.toObject());
			applyChanges(preview, [...directChanges, ...sensitiveChanges]);
			await preview.validate();
		}

		if (sensitiveChanges.length) {
			const fields = sensitiveChanges.map((c) => c.field);
			const overlapping = await ChangeRequest.find({
				entityType,
				entityId,
				status: "pending",
				"changes.field": { $in: fields },
			}).session(session);

			const blocking = overlapping.filter((cr) => !sameId(cr.requestedBy, actor._id));

			// Idempotent re-submit: the requester already has a pending request asking
			// for exactly these values (e.g. the form was saved twice) — reuse it.
			const alreadyRequested = overlapping.find(
				(cr) =>
					sameId(cr.requestedBy, actor._id) &&
					sensitiveChanges.every((change) =>
						cr.changes.some((c) => c.field === change.field && valuesEqual(c.newValue, change.newValue)),
					),
			);
			if (blocking.length) {
				throw new HttpError(
					409,
					"Another broker already has a pending change request for these fields",
					{
						code: "PENDING_REQUEST_EXISTS",
						details: { changeRequestIds: blocking.map((cr) => cr._id) },
					},
				);
			}

			if (alreadyRequested) {
				pending = alreadyRequested;
				reusedExisting = true;
			} else {
				pending = await replaceOwnRequests({
					entity,
					entityType,
					entityId,
					actor,
					overlapping,
					sensitiveChanges,
					superseded,
					session,
				});
			}
		}

		if (directChanges.length) {
			await validateReferences(directChanges, session);
			applyChanges(entity, directChanges);
			entity.revision += 1;
			await entity.save({ session });
			await recordStageTransitions({
				entityType,
				entity,
				changes: directChanges,
				actor,
				via: "direct",
				session,
			});
			await audit.record(
				{
					actor: actor._id,
					action: `${entityType}.update`,
					entityType,
					entityId: entity._id,
					summary: `Updated ${entityType} ${labelOf(entityType, entity)}: ${fieldList(directChanges)}`,
					...audit.changeSets(directChanges),
				},
				{ session },
			);
		} else if (pending && !reusedExisting) {
			await bumpRevision(Model, entityId, session);
		}

		if (pending && !reusedExisting) {
			await audit.record(
				{
					actor: actor._id,
					action: "change_request.create",
					entityType: "change_request",
					entityId: pending._id,
					subject: { type: entityType, id: entity._id },
					summary: `Requested approval for ${entityType} ${labelOf(entityType, entity)}: ${fieldList(pending.changes)}`,
					...audit.changeSets(pending.changes),
					meta: superseded.length ? { superseded } : null,
				},
				{ session },
			);
		}

		result = {
			entity,
			pending,
			applied: directChanges.map((c) => c.field),
			unchanged,
			superseded,
		};
	});

	return result;
};

// The requester's own older requests are replaced; fields they had that this
// edit doesn't touch are carried over so nothing silently disappears.
const replaceOwnRequests = async ({
	entity,
	entityType,
	entityId,
	actor,
	overlapping,
	sensitiveChanges,
	superseded,
	session,
}) => {
	const fields = sensitiveChanges.map((c) => c.field);
	const carried = new Map();
	for (const cr of overlapping) {
		for (const change of cr.changes) {
			if (!fields.includes(change.field) && !valuesEqual(entity.get(change.field), change.newValue)) {
				carried.set(change.field, {
					field: change.field,
					oldValue: normalizeValue(entity.get(change.field)),
					newValue: change.newValue,
				});
			}
		}
		cr.status = "superseded";
		cr.resolvedAt = new Date();
		await cr.save({ session });
		superseded.push(cr._id);
	}

	const [created] = await ChangeRequest.create(
		[
			{
				entityType,
				entityId,
				requestedBy: actor._id,
				changes: [...sensitiveChanges, ...carried.values()],
			},
		],
		{ session },
	);
	return created;
};

/**
 * @param decision "approved" | "rejected"
 * @returns the resolved ChangeRequest (status may be "conflict" for stale approvals)
 */
const resolveChangeRequest = async ({ id, decision, actor, adminNote }) => {
	if (!["approved", "rejected"].includes(decision)) {
		throw new HttpError(400, "Decision must be approved or rejected");
	}

	let resolved;

	await mongoose.connection.transaction(async (session) => {
		// Atomic claim: only one caller can move a request out of "pending".
		const cr = await ChangeRequest.findOneAndUpdate(
			{ _id: id, status: "pending" },
			{
				$set: {
					status: decision,
					resolvedBy: actor._id,
					resolvedAt: new Date(),
					...(adminNote ? { adminNote } : {}),
				},
			},
			{ returnDocument: "after", session },
		);

		if (!cr) {
			const existing = await ChangeRequest.findById(id).session(session).lean();
			if (!existing) throw new HttpError(404, "Change request not found");
			throw new HttpError(409, `This change request is already ${existing.status}`, {
				code: "ALREADY_RESOLVED",
			});
		}

		const { Model } = getEntry(cr.entityType);
		const entity = await Model.findById(cr.entityId).session(session);

		if (decision === "approved") {

			// Stale detection: the requester saw oldValue; if someone changed the field
			// since, applying newValue would silently overwrite their change.
			const conflictFields =
				entity ?
					cr.changes.filter((c) => !valuesEqual(entity.get(c.field), c.oldValue)).map((c) => c.field)
				:	cr.changes.map((c) => c.field);

			if (conflictFields.length) {
				cr.status = "conflict";
				cr.conflictFields = conflictFields;
				await cr.save({ session });
			} else {
				await validateReferences(cr.changes, session);
				applyChanges(entity, cr.changes);
				entity.revision += 1;
				await entity.save({ session }); // schema validation failure aborts everything
				await recordStageTransitions({
					entityType: cr.entityType,
					entity,
					changes: cr.changes,
					actor,
					via: "change_request",
					session,
				});
			}
		}

		await audit.record(
			{
				actor: actor._id,
				action: `change_request.${cr.status}`,
				entityType: "change_request",
				entityId: cr._id,
				subject: { type: cr.entityType, id: cr.entityId },
				summary: `Change request for ${cr.entityType} ${labelOf(cr.entityType, entity)} ${cr.status}: ${fieldList(cr.changes)}`,
				...audit.changeSets(cr.changes),
				meta: {
					...(cr.adminNote ? { adminNote: cr.adminNote } : {}),
					...(cr.conflictFields?.length ? { conflictFields: cr.conflictFields } : {}),
				},
			},
			{ session },
		);

		await Notification.create(
			[
				{
					user: cr.requestedBy,
					kind: "change_request_resolved",
					payload: {
						changeRequestId: cr._id,
						entityType: cr.entityType,
						entityId: cr.entityId,
						status: cr.status,
						adminNote: cr.adminNote,
						changes: cr.changes,
						conflictFields: cr.conflictFields,
					},
				},
			],
			{ session },
		);

		resolved = cr;
	});

	dispatchSoon();
	return resolved;
};

const withdrawChangeRequest = async ({ id, actor }) => {
	let cr;
	await mongoose.connection.transaction(async (session) => {
		cr = await ChangeRequest.findOneAndUpdate(
			{ _id: id, status: "pending", requestedBy: actor._id },
			{ $set: { status: "withdrawn", resolvedAt: new Date() } },
			{ returnDocument: "after", session },
		);
		if (!cr) return;
		await audit.record(
			{
				actor: actor._id,
				action: "change_request.withdrawn",
				entityType: "change_request",
				entityId: cr._id,
				subject: { type: cr.entityType, id: cr.entityId },
				summary: `Withdrew change request for ${cr.entityType}: ${fieldList(cr.changes)}`,
				...audit.changeSets(cr.changes),
			},
			{ session },
		);
	});
	if (cr) return cr;

	const existing = await ChangeRequest.findById(id).lean();
	if (!existing) throw new HttpError(404, "Change request not found");
	if (!sameId(existing.requestedBy, actor._id)) {
		throw new HttpError(403, "Only the requester can withdraw a change request");
	}
	throw new HttpError(409, `This change request is already ${existing.status}`, {
		code: "ALREADY_RESOLVED",
	});
};

// Human-readable summary for API responses.
const describeProposal = ({ applied, pending }) => {
	if (applied.length && pending) return "Changes saved; sensitive fields sent for approval";
	if (pending) return "Sensitive changes sent for approval";
	if (applied.length) return "Changes saved";
	return "No changes detected";
};

module.exports = {
	proposeChanges,
	describeProposal,
	resolveChangeRequest,
	withdrawChangeRequest,
	registry,
};

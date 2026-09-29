/**
 * Client ownership protection.
 *
 * A client's phone number (normalised to +91XXXXXXXXXX) is unique among live
 * clients, enforced by a unique index, so of two brokers registering the same
 * buyer — even at the same instant — exactly one succeeds. The other gets a 409
 * that reveals nothing about the existing record except when it was registered,
 * and an ownership claim is opened for an admin to review.
 */
const mongoose = require("mongoose");
const Client = require("../models/Client");
const AuditLog = require("../models/AuditLog");
const OwnershipClaim = require("../models/OwnershipClaim");
const { HttpError } = require("../utils/httpError");
const { isAdmin, sameId } = require("../policies");
const audit = require("./auditService");

const ALREADY_REGISTERED = "CLIENT_ALREADY_REGISTERED";

// The first audit entry for the client proves when (and by whom) it was registered.
const evidenceFor = async (client, session) => {
	const first = await AuditLog.findOne({
		entityType: "client",
		entityId: client._id,
		action: { $in: ["client.create", "client.legacy"] },
	})
		.sort({ seq: 1 })
		.session(session || null)
		.lean();
	return {
		registeredAt: first?.at || client.createdAt,
		firstAuditSeq: first?.seq ?? null,
		firstAuditHash: first?.hash ?? null,
	};
};

const openClaim = async ({ existing, actor, submitted, phoneKey }) => {
	let claim;
	await mongoose.connection.transaction(async (session) => {
		claim = await OwnershipClaim.findOne({ phoneKey, claimant: actor._id, status: "open" }).session(session);
		if (claim) return;
		[claim] = await OwnershipClaim.create(
			[
				{
					phoneKey,
					existingClient: existing._id,
					existingBroker: existing.assignedBroker ?? null,
					claimant: actor._id,
					submitted,
					evidence: await evidenceFor(existing, session),
				},
			],
			{ session },
		);
		await audit.record(
			{
				actor: actor._id,
				action: "ownership_claim.create",
				entityType: "ownership_claim",
				entityId: claim._id,
				subject: { type: "client", id: existing._id },
				summary: `${actor.name || "A broker"} tried to register ${submitted.name || "a client"} already owned by another broker`,
				after: { submitted, existingClient: existing._id, existingBroker: existing.assignedBroker ?? null },
			},
			{ session },
		);
	});
	return claim;
};

/**
 * Called when creating a client whose phone is already registered. Always throws 409.
 */
const rejectDuplicate = async ({ phoneKey, actor, data }) => {
	const existing = await Client.findOne({ phoneKey });
	if (!existing) return; // the other record disappeared (e.g. deleted); caller may retry

	if (sameId(existing.assignedBroker, actor._id)) {
		throw new HttpError(409, `You have already registered this client as ${existing.clientCode}`, {
			code: ALREADY_REGISTERED,
			details: { clientId: existing._id, clientCode: existing.clientCode },
		});
	}

	if (isAdmin(actor)) {
		throw new HttpError(409, `This phone number belongs to existing client ${existing.clientCode}`, {
			code: ALREADY_REGISTERED,
			details: { clientId: existing._id, clientCode: existing.clientCode, assignedBroker: existing.assignedBroker },
		});
	}

	const submitted = { name: data.name, email: data.email, phone: data.phone };
	let claim;
	try {
		claim = await openClaim({ existing, actor, submitted, phoneKey });
	} catch (error) {
		// Two identical attempts at once: the unique open-claim index let one through.
		if (error.code !== 11000) throw error;
		claim = await OwnershipClaim.findOne({ phoneKey, claimant: actor._id, status: "open" });
	}

	// Deliberately no name, broker or contact details of the existing client.
	throw new HttpError(
		409,
		"This client is already registered with another broker. An ownership claim has been sent to an admin for review.",
		{
			code: ALREADY_REGISTERED,
			details: { registeredAt: claim.evidence.registeredAt, claimId: claim._id },
		},
	);
};

const isPhoneKeyConflict = (error) => error?.code === 11000 && Boolean(error.keyPattern?.phoneKey);

/**
 * decision "keep": the existing broker keeps the client.
 * decision "transfer": the client is reassigned to the claimant through the
 * approval engine (an admin edit), in the same transaction as the decision.
 */
const resolveClaim = async ({ id, decision, note, actor }) => {
	// Required lazily: approvalService → auditService, and lifecycle → this module.
	const { proposeChanges } = require("./approvalService");
	const status = decision === "transfer" ? "transferred" : "upheld";
	let claim;

	await mongoose.connection.transaction(async (session) => {
		claim = await OwnershipClaim.findOneAndUpdate(
			{ _id: id, status: "open" },
			{ $set: { status, resolvedBy: actor._id, resolvedAt: new Date(), ...(note ? { note } : {}) } },
			{ returnDocument: "after", session },
		);
		if (!claim) {
			const existing = await OwnershipClaim.findById(id).session(session).lean();
			if (!existing) throw new HttpError(404, "Ownership claim not found");
			throw new HttpError(409, `This claim is already ${existing.status}`, { code: "ALREADY_RESOLVED" });
		}

		if (status === "transferred") {
			await proposeChanges({
				entityType: "client",
				entityId: claim.existingClient,
				patch: { assignedBroker: claim.claimant.toString() },
				actor,
				session,
			});
		}

		await audit.record(
			{
				actor: actor._id,
				action: `ownership_claim.${status}`,
				entityType: "ownership_claim",
				entityId: claim._id,
				subject: { type: "client", id: claim.existingClient },
				summary:
					status === "transferred" ?
						"Ownership claim accepted: client transferred to the claimant"
					:	"Ownership claim declined: the existing broker keeps the client",
				meta: note ? { note } : null,
			},
			{ session },
		);
	});

	return claim;
};

module.exports = { rejectDuplicate, isPhoneKeyConflict, resolveClaim, evidenceFor, ALREADY_REGISTERED };

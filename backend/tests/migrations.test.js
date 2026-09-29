const mongoose = require("mongoose");
const mergeChangeRequests = require("../migrations/20260929120000-merge-change-requests");
const ChangeRequest = require("../models/ChangeRequest");

describe("migration: merge change requests", () => {
	const seedLegacy = async () => {
		const db = mongoose.connection.db;
		const clientId = new mongoose.Types.ObjectId();
		const propertyId = new mongoose.Types.ObjectId();
		const userId = new mongoose.Types.ObjectId();
		await db.collection("clientchangerequests").insertOne({
			client: clientId,
			requestedBy: userId,
			status: "pending",
			changes: [{ _id: new mongoose.Types.ObjectId(), field: "pipelineStage", oldValue: "lead", newValue: "closed" }],
			createdAt: new Date("2026-08-01"),
			__v: 0,
		});
		await db.collection("propertychangerequests").insertOne({
			property: propertyId,
			requestedBy: userId,
			status: "approved",
			changes: [{ field: "status", oldValue: "available", newValue: "sold" }],
			resolvedAt: new Date("2026-08-03"),
			createdAt: new Date("2026-08-02"),
		});
		return { clientId, propertyId };
	};

	test("copies both legacy collections and is idempotent", async () => {
		const { clientId, propertyId } = await seedLegacy();
		const db = mongoose.connection.db;

		await mergeChangeRequests.up(db);
		await mergeChangeRequests.up(db); // second run must not duplicate

		const merged = await ChangeRequest.find().sort({ createdAt: 1 }).lean();
		expect(merged).toHaveLength(2);
		expect(merged[0]).toMatchObject({
			entityType: "client",
			entityModel: "Client",
			status: "pending",
			changes: [{ field: "pipelineStage", oldValue: "lead", newValue: "closed" }],
		});
		expect(merged[0].entityId.toString()).toBe(clientId.toString());
		expect(merged[1]).toMatchObject({ entityType: "property", status: "approved" });
		expect(merged[1].entityId.toString()).toBe(propertyId.toString());

		// Legacy data is untouched.
		expect(await db.collection("clientchangerequests").countDocuments()).toBe(1);
	});

	test("down removes only migrated documents", async () => {
		await seedLegacy();
		const db = mongoose.connection.db;
		await mergeChangeRequests.up(db);
		await ChangeRequest.create({
			entityType: "client",
			entityId: new mongoose.Types.ObjectId(),
			requestedBy: new mongoose.Types.ObjectId(),
			changes: [{ field: "notes", oldValue: null, newValue: "x" }],
		});

		await mergeChangeRequests.down(db);
		expect(await ChangeRequest.countDocuments()).toBe(1);
	});
});

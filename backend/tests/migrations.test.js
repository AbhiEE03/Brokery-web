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

describe("migration: backfill stage transitions", () => {
	const backfill = require("../migrations/20260929130000-backfill-stage-transitions");
	const StageTransition = require("../models/StageTransition");

	test("adds one flagged row per client without history, and is idempotent", async () => {
		const db = mongoose.connection.db;
		const created = new Date("2026-05-01");
		const closedAt = new Date("2026-06-10");
		const { insertedIds } = await db.collection("clients").insertMany([
			{ clientCode: "CL-000001", name: "A", pipelineStage: "closed", createdAt: created, updatedAt: closedAt },
			{ clientCode: "CL-000002", name: "B", pipelineStage: "lead", createdAt: created, updatedAt: closedAt },
		]);

		await backfill.up(db);
		await backfill.up(db);

		const rows = await StageTransition.find().sort({ to: 1 }).lean();
		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({ to: "closed", backfilled: true, at: closedAt });
		expect(rows[1]).toMatchObject({ to: "lead", at: created });
		expect(rows[0].client.toString()).toBe(insertedIds[0].toString());
	});
});

describe("migration: code counters", () => {
	const initCounters = require("../migrations/20260929130200-init-code-counters");
	const { nextPropertyCode, nextClientCode } = require("../utils/codeGenerator");

	test("new codes continue after the highest existing code", async () => {
		const db = mongoose.connection.db;
		await db.collection("clients").insertMany([{ clientCode: "CL-000009" }, { clientCode: "CL-000012" }]);
		// "99ZZ" sorts after "100AA" as a string; decoding must still find the max.
		await db.collection("properties").insertMany([{ propertyCode: "99ZZ" }, { propertyCode: "100AA" }]);

		await initCounters.up(db);
		await initCounters.up(db);

		expect(await nextClientCode()).toBe("CL-000013");
		expect(await nextPropertyCode()).toBe("100AB");
	});
});

describe("migration: activity log into the audit chain", () => {
	const migration = require("../migrations/20260930090000-activity-to-audit-log");
	const AuditLog = require("../models/AuditLog");
	const audit = require("../services/auditService");

	test("copies old entries oldest-first into a valid chain, idempotently, and new entries continue it", async () => {
		const db = mongoose.connection.db;
		const user = new mongoose.Types.ObjectId();
		await db.collection("activitylogs").insertMany([
			{ performedBy: user, action: "Created client Asha", entity: "client", entityId: new mongoose.Types.ObjectId(), createdAt: new Date("2026-08-02") },
			{ performedBy: user, action: "Updated property 00AB", entity: "property", createdAt: new Date("2026-08-01"), metadata: { method: "PATCH" } },
			{ performedBy: user, action: "Something odd", createdAt: new Date("2026-08-03") },
		]);

		await migration.up(db);
		await migration.up(db);

		const entries = await AuditLog.find().sort({ seq: 1 }).lean();
		expect(entries.map((e) => [e.seq, e.summary, e.legacy])).toEqual([
			[1, "Updated property 00AB", true],
			[2, "Created client Asha", true],
			[3, "Something odd", true],
		]);
		expect(entries[2].entityType).toBe("user");
		expect(await audit.verifyChain()).toEqual({ ok: true, checked: 3 });

		await audit.record({ actor: user, action: "client.update", entityType: "client", summary: "after migration" });
		expect(await audit.verifyChain()).toEqual({ ok: true, checked: 4 });
	});
});

describe("migration: client phone keys", () => {
	const migration = require("../migrations/20260930090100-backfill-client-phone-keys");

	test("keys the oldest live client per number, reports duplicates and invalid numbers, idempotently", async () => {
		const db = mongoose.connection.db;
		// Collection created without the model's index, like production before the migration.
		await db.collection("clients").drop().catch(() => {});
		await db.collection("clients").insertMany([
			{ clientCode: "CL-000001", phone: "9876543210", createdAt: new Date("2026-01-01") },
			{ clientCode: "CL-000002", phone: "+91 98765 43210", createdAt: new Date("2026-02-01") },
			{ clientCode: "CL-000003", phone: "12345", createdAt: new Date("2026-03-01") },
			{ clientCode: "CL-000004", phone: "9123456789", createdAt: new Date("2026-04-01"), deletedAt: new Date() },
			{ clientCode: "CL-000005", phone: "091234 56789", createdAt: new Date("2026-05-01") },
		]);

		const log = jest.spyOn(console, "log").mockImplementation(() => {});
		const first = await migration.up(db);
		const second = await migration.up(db);
		log.mockRestore();

		expect(first).toEqual({ keyed: 2, duplicates: ["CL-000002 duplicates CL-000001"], invalid: ["CL-000003"] });
		expect(second).toEqual(first);
		const keys = Object.fromEntries(
			(await db.collection("clients").find().toArray()).map((c) => [c.clientCode, c.phoneKey ?? null]),
		);
		expect(keys).toEqual({
			"CL-000001": "+919876543210",
			"CL-000002": null,
			"CL-000003": null,
			"CL-000004": null,
			"CL-000005": "+919123456789",
		});
		await expect(
			db.collection("clients").insertOne({ clientCode: "CL-000006", phoneKey: "+919876543210" }),
		).rejects.toMatchObject({ code: 11000 });
	});
});

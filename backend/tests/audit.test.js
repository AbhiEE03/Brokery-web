const mongoose = require("mongoose");
const {
	request,
	makeUser,
	makeClient,
	makeProperty,
	authHeader,
} = require("./factories");
const AuditLog = require("../models/AuditLog");
const Counter = require("../models/Counter");
const audit = require("../services/auditService");

const actions = async () => (await AuditLog.find().sort({ seq: 1 }).lean()).map((e) => e.action);

describe("audit log: one entry per change", () => {
	test("create, direct edit, proposal, approval and delete each write exactly one entry", async () => {
		const admin = await makeUser({ role: "admin" });
		const broker = await makeUser();
		const as = (user) => authHeader(user);

		const created = await request()
			.post("/api/clients")
			.set(as(broker))
			.send({ name: "Ravi", phone: "9876512345", requirements: { city: "Pune", minBudget: 10, maxBudget: 20 } });
		expect(created.status).toBe(201);
		const id = created.body.data._id;
		expect(await actions()).toEqual(["client.create"]);

		await request().patch(`/api/clients/${id}`).set(as(broker)).send({ notes: "call after 6pm" });
		expect(await actions()).toEqual(["client.create", "client.update"]);

		const proposed = await request()
			.patch(`/api/clients/${id}`)
			.set(as(broker))
			.send({ requirements: { maxBudget: 30 } });
		expect(proposed.status).toBe(202);

		// Saving the identical proposal again changes nothing, so it records nothing.
		await request().patch(`/api/clients/${id}`).set(as(broker)).send({ requirements: { maxBudget: 30 } });

		await request().post(`/api/change-requests/${proposed.body.data.pending._id}/approve`).set(as(admin)).send({});
		await request().delete(`/api/clients/${id}`).set(as(admin));

		const entries = await AuditLog.find().sort({ seq: 1 }).lean();
		expect(entries.map((e) => e.action)).toEqual([
			"client.create",
			"client.update",
			"change_request.create",
			"change_request.approved",
			"client.delete",
		]);
		expect(entries[1].before).toEqual({ notes: null });
		expect(entries[1].after).toEqual({ notes: "call after 6pm" });
		expect(entries[3].after).toEqual({ "requirements.maxBudget": 30 });
		expect(entries[3].subject.id.toString()).toBe(id);
		expect(entries.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5]);
	});

	test("matches, uploads, accounts and logins are recorded; passwords never are", async () => {
		const admin = await makeUser({ role: "admin" });
		const broker = await makeUser();
		const client = await makeClient({ broker });
		const property = await makeProperty({ addedBy: broker });

		const match = await request()
			.post("/api/matches")
			.set(authHeader(broker))
			.send({ client: client._id, property: property._id, interestLevel: "high" });
		await request().patch(`/api/matches/${match.body.data._id}`).set(authHeader(broker)).send({ interestLevel: "low" });
		await request().delete(`/api/matches/${match.body.data._id}`).set(authHeader(broker));

		await request()
			.post("/api/auth/register")
			.set(authHeader(admin))
			.send({ name: "New Broker", email: "new.broker@test.com", password: "Secret@12345" });
		await request().post("/api/auth/login").send({ email: "new.broker@test.com", password: "Secret@12345" });
		await request().post("/api/auth/login").send({ email: "new.broker@test.com", password: "wrong-password" });
		await request().post("/api/auth/login").send({ email: "nobody@test.com", password: "wrong-password" });

		expect(await actions()).toEqual([
			"match.create",
			"match.update",
			"match.delete",
			"user.create",
			"auth.login",
			"auth.login_failed",
			"auth.login_failed",
		]);

		const raw = JSON.stringify(await AuditLog.find().lean());
		expect(raw).not.toMatch(/Secret@12345|\$2[aby]\$/);
		const unknown = await AuditLog.findOne({ action: "auth.login_failed", actor: null }).lean();
		expect(unknown.meta).toEqual({ email: "nobody@test.com", knownUser: false });
	});

	test("the request id from X-Request-Id is stored on the entry", async () => {
		const broker = await makeUser();
		await request()
			.post("/api/clients")
			.set(authHeader(broker))
			.set("X-Request-Id", "trace-abc-123")
			.send({ name: "Traced", phone: "9876512399", requirements: { city: "Pune" } });
		expect((await AuditLog.findOne().lean()).requestId).toBe("trace-abc-123");
	});
});

describe("audit log: atomicity and ordering", () => {
	test("a rolled-back transaction leaves no entry and doesn't advance the chain", async () => {
		const actor = await makeUser();
		await expect(
			mongoose.connection.transaction(async (session) => {
				await audit.record({ actor: actor._id, action: "client.update", entityType: "client", summary: "doomed" }, { session });
				throw new Error("boom");
			}),
		).rejects.toThrow("boom");

		expect(await AuditLog.countDocuments()).toBe(0);
		expect((await Counter.findById("audit").lean())?.seq ?? 0).toBe(0);

		await audit.record({ actor: actor._id, action: "client.update", entityType: "client", summary: "kept" });
		expect((await AuditLog.findOne().lean()).seq).toBe(1);
		expect(await audit.verifyChain()).toEqual({ ok: true, checked: 1 });
	});

	test("an approval that fails validation rolls back its audit entry too", async () => {
		const admin = await makeUser({ role: "admin" });
		const broker = await makeUser();
		const client = await makeClient({ broker });
		const proposed = await request()
			.patch(`/api/clients/${client._id}`)
			.set(authHeader(broker))
			.send({ assignedBroker: broker._id.toString(), requirements: { maxBudget: 9500000 } });
		const before = await AuditLog.countDocuments();

		// The broker is deactivated before approval, so applying assignedBroker fails.
		await mongoose.model("User").updateOne({ _id: broker._id }, { isActive: false });
		await mongoose.model("ChangeRequest").updateOne(
			{ _id: proposed.body.data.pending._id },
			{ $push: { changes: { field: "assignedBroker", oldValue: broker._id, newValue: new mongoose.Types.ObjectId() } } },
		);
		const res = await request().post(`/api/change-requests/${proposed.body.data.pending._id}/approve`).set(authHeader(admin)).send({});
		expect(res.status).toBeGreaterThanOrEqual(400);
		expect(await AuditLog.countDocuments()).toBe(before);
	});

	test("50 concurrent writers produce a gap-free, valid chain", async () => {
		const actor = await makeUser();
		await Promise.all(
			Array.from({ length: 50 }, (_, i) =>
				audit.record({ actor: actor._id, action: "client.update", entityType: "client", summary: `write ${i}` }),
			),
		);
		const seqs = (await AuditLog.find().sort({ seq: 1 }).lean()).map((e) => e.seq);
		expect(seqs).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
		expect(await audit.verifyChain()).toEqual({ ok: true, checked: 50 });
	});
});

describe("audit log: tamper evidence", () => {
	const seed = async (n) => {
		const actor = await makeUser();
		for (let i = 0; i < n; i += 1) {
			await audit.record({ actor: actor._id, action: "client.update", entityType: "client", summary: `entry ${i + 1}`, after: { i } });
		}
	};

	test("editing a stored entry is pinpointed by verify", async () => {
		await seed(6);
		await AuditLog.updateOne({ seq: 4 }, { $set: { after: { i: 999 } } });
		expect(await audit.verifyChain()).toMatchObject({ ok: false, firstBrokenSeq: 4, checked: 3 });
	});

	test("recomputing the edited entry's hash still breaks the next link", async () => {
		await seed(6);
		const target = await AuditLog.findOne({ seq: 3 }).lean();
		const forged = { ...target, summary: "forged" };
		await AuditLog.updateOne({ seq: 3 }, { $set: { summary: "forged", hash: audit.computeHash(target.prevHash, forged) } });
		expect(await audit.verifyChain()).toMatchObject({ ok: false, firstBrokenSeq: 4 });
	});

	test("deleting an entry in the middle or at the end is detected", async () => {
		await seed(5);
		await AuditLog.deleteOne({ seq: 5 });
		expect(await audit.verifyChain()).toMatchObject({ ok: false, firstBrokenSeq: 5 });

		await AuditLog.deleteOne({ seq: 2 });
		expect(await audit.verifyChain()).toMatchObject({ ok: false, firstBrokenSeq: 2 });
	});

	test("GET /api/activity/verify is admin-only and reports a healthy chain", async () => {
		const admin = await makeUser({ role: "admin" });
		const broker = await makeUser();
		await seed(3);
		expect((await request().get("/api/activity/verify").set(authHeader(broker))).status).toBe(403);
		const res = await request().get("/api/activity/verify").set(authHeader(admin));
		expect(res.body.data).toEqual({ ok: true, checked: 3 });
	});
});

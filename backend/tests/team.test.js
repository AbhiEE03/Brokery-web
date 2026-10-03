const jwt = require("jsonwebtoken");
const { request, makeUser, makeClient, authHeader } = require("./factories");
const User = require("../models/User");
const Client = require("../models/Client");
const AuditLog = require("../models/AuditLog");
const approvalService = require("../services/approvalService");
const team = require("../services/teamService");

const as = (user) => ({ authorization: `Bearer ${user.token}` });
const login = async (email, password) => request().post("/api/auth/login").send({ email, password });
const signedIn = async (overrides) => {
	const password = "Password@123";
	const user = await makeUser({ password, ...overrides });
	const res = await login(user.email, password);
	return { ...user.toObject(), token: res.body.data.token };
};

describe("team management: access", () => {
	test("every endpoint is admin-only", async () => {
		const broker = await makeUser();
		const id = broker._id;
		const calls = [
			request().get("/api/users/brokers"),
			request().post("/api/users").send({ name: "X", email: "x@test.com" }),
			request().patch(`/api/users/${id}/status`).send({ isActive: false }),
			request().post(`/api/users/${id}/reset-password`),
			request().post(`/api/users/${id}/reassign-clients`).send({ toBrokerId: id }),
		];
		for (const call of calls) expect((await call.set(authHeader(broker))).status).toBe(403);
	});
});

describe("listing and adding brokers", () => {
	test("lists brokers with live and open client counts; inactive ones on request", async () => {
		const admin = await makeUser({ role: "admin" });
		const busy = await makeUser({ name: "Busy" });
		await makeUser({ name: "Gone", isActive: false });
		await makeClient({ broker: busy });
		await makeClient({ broker: busy, pipelineStage: "closed" });

		const active = await request().get("/api/users/brokers").set(authHeader(admin));
		expect(active.body.data.map((b) => [b.name, b.clientCount, b.openClientCount])).toEqual([["Busy", 2, 1]]);
		const all = await request().get("/api/users/brokers?includeInactive=1").set(authHeader(admin));
		expect(all.body.data.map((b) => b.name)).toEqual(["Busy", "Gone"]);
	});

	test("a generated password is returned once, works, and is never stored or logged in plain text", async () => {
		const admin = await makeUser({ role: "admin" });
		const res = await request().post("/api/users").set(authHeader(admin)).send({ name: "Tiya", email: "Tiya@Brokery.com" });
		expect(res.status).toBe(201);
		const { generatedPassword, user } = res.body.data;
		expect(generatedPassword).toMatch(/^.{16}$/);
		expect(user).toMatchObject({ email: "tiya@brokery.com", role: "broker", isActive: true });

		expect((await login("tiya@brokery.com", generatedPassword)).status).toBe(200);
		const stored = await User.findById(user._id).lean();
		expect(stored.password).toMatch(/^\$2[aby]\$/);
		expect(JSON.stringify(await AuditLog.find().lean())).not.toContain(generatedPassword);
		expect(await AuditLog.countDocuments({ action: "user.create" })).toBe(1);
	});

	test("a chosen password must be at least 10 characters; emails are unique", async () => {
		const admin = await makeUser({ role: "admin" });
		const short = await request().post("/api/users").set(authHeader(admin)).send({ name: "A", email: "a@test.com", password: "short" });
		expect(short.status).toBe(400);
		await request().post("/api/users").set(authHeader(admin)).send({ name: "A", email: "a@test.com", password: "LongEnough@1" });
		const dup = await request().post("/api/users").set(authHeader(admin)).send({ name: "A", email: "A@test.com" });
		expect(dup.status).toBe(409);
	});
});

describe("deactivation", () => {
	test("takes effect on the very next request, blocks login, and can be undone", async () => {
		const admin = await makeUser({ role: "admin" });
		const broker = await signedIn();
		expect((await request().get("/api/clients").set(as(broker))).status).toBe(200);

		const off = await request().patch(`/api/users/${broker._id}/status`).set(authHeader(admin)).send({ isActive: false });
		expect(off.status).toBe(200);
		expect((await request().get("/api/clients").set(as(broker))).status).toBe(401);
		expect((await login(broker.email, "Password@123")).status).toBe(403);

		await request().patch(`/api/users/${broker._id}/status`).set(authHeader(admin)).send({ isActive: true });
		expect((await login(broker.email, "Password@123")).status).toBe(200);
		expect((await AuditLog.find({ action: /^user\.(de|re)activate$/ }).lean()).map((e) => e.action)).toEqual(["user.deactivate", "user.reactivate"]);
	});

	test("you can't deactivate yourself, and the last active admin can't be deactivated", async () => {
		const admin = await makeUser({ role: "admin" });
		const self = await request().patch(`/api/users/${admin._id}/status`).set(authHeader(admin)).send({ isActive: false });
		expect(self.status).toBe(409);
		expect(self.body.code).toBe("CANNOT_DEACTIVATE_SELF");

		// The only active admin, deactivated by someone else (e.g. an admin who was just switched off).
		await expect(team.setStatus({ userId: admin._id, isActive: false, actor: { _id: (await makeUser())._id } })).rejects.toMatchObject({
			status: 409,
			code: "LAST_ADMIN",
		});
		expect((await User.findById(admin._id)).isActive).toBe(true);
	});

	test("two admins deactivating each other at the same moment never leave zero admins (write skew)", async () => {
		// Each transaction reads "2 active admins" and writes a *different* user, so under
		// snapshot isolation both could commit and leave none. The audit chain happens to
		// serialize them too, so it's switched off here to prove the roster guard alone holds.
		// Without the guard this ends with zero admins in 20/20 rounds.
		const auditService = require("../services/auditService");
		const spy = jest.spyOn(auditService, "record").mockResolvedValue(null);
		try {
			for (let round = 0; round < 20; round += 1) {
				await User.deleteMany({});
				const a = await makeUser({ role: "admin" });
				const b = await makeUser({ role: "admin" });
				const results = await Promise.allSettled([
					team.setStatus({ userId: b._id, isActive: false, actor: a }),
					team.setStatus({ userId: a._id, isActive: false, actor: b }),
				]);
				expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
				expect(results.find((r) => r.status === "rejected").reason).toMatchObject({ code: "LAST_ADMIN" });
				expect(await User.countDocuments({ role: "admin", isActive: true })).toBe(1);
			}
		} finally {
			spy.mockRestore();
		}
	});
});

describe("password reset", () => {
	test("ends every existing session; only the new temporary password works", async () => {
		const admin = await makeUser({ role: "admin" });
		const broker = await signedIn();
		const res = await request().post(`/api/users/${broker._id}/reset-password`).set(authHeader(admin));
		expect(res.status).toBe(200);
		const { temporaryPassword } = res.body.data;

		const old = await request().get("/api/clients").set(as(broker));
		expect(old.status).toBe(401);
		expect(old.body.code).toBe("SESSION_REVOKED");
		expect((await login(broker.email, "Password@123")).status).toBe(401);

		const fresh = await login(broker.email, temporaryPassword);
		expect(fresh.status).toBe(200);
		expect((await request().get("/api/clients").set({ authorization: `Bearer ${fresh.body.data.token}` })).status).toBe(200);
		expect(JSON.stringify(await AuditLog.find({ action: "user.password_reset" }).lean())).not.toContain(temporaryPassword);
	});

	test("tokens issued before session versions existed keep working until a reset", async () => {
		const broker = await makeUser();
		const legacy = jwt.sign({ id: broker._id, role: "broker" }, process.env.JWT_SECRET, { expiresIn: "1h" });
		expect((await request().get("/api/clients").set({ authorization: `Bearer ${legacy}` })).status).toBe(200);
	});
});

describe("reassigning a leaving broker's clients", () => {
	const setup = async () => {
		const admin = await makeUser({ role: "admin" });
		const leaving = await makeUser({ name: "Leaving" });
		const taking = await makeUser({ name: "Taking" });
		const clients = [await makeClient({ broker: leaving }), await makeClient({ broker: leaving }), await makeClient({ broker: leaving, pipelineStage: "closed" })];
		return { admin, leaving, taking, clients };
	};
	const reassign = (admin, from, to) =>
		request().post(`/api/users/${from._id}/reassign-clients`).set(authHeader(admin)).send({ toBrokerId: to._id });

	test("moves every client in one go, audited per client", async () => {
		const { admin, leaving, taking } = await setup();
		const res = await reassign(admin, leaving, taking);
		expect(res.status).toBe(200);
		expect(res.body.data.moved).toBe(3);
		expect(await Client.countDocuments({ assignedBroker: taking._id })).toBe(3);
		expect(await Client.countDocuments({ assignedBroker: leaving._id })).toBe(0);
		expect(await AuditLog.countDocuments({ action: "client.update", "after.assignedBroker": taking._id.toString() })).toBe(3);
		expect((await AuditLog.findOne({ action: "user.clients_reassigned" }).lean()).summary).toBe("Moved 3 clients from Leaving to Taking");
	});

	test("only to an active broker, and not to the same broker", async () => {
		const { admin, leaving, taking } = await setup();
		await User.updateOne({ _id: taking._id }, { isActive: false });
		expect((await reassign(admin, leaving, taking)).status).toBe(400);
		expect((await reassign(admin, leaving, leaving)).status).toBe(400);
		expect(await Client.countDocuments({ assignedBroker: leaving._id })).toBe(3);
	});

	test("a failure part-way through rolls every move back", async () => {
		const { admin, leaving, taking } = await setup();
		const real = approvalService.proposeChanges;
		let calls = 0;
		const spy = jest.spyOn(approvalService, "proposeChanges").mockImplementation(async (args) => {
			calls += 1;
			if (calls === 2) throw new Error("simulated failure");
			return real(args);
		});
		const res = await reassign(admin, leaving, taking);
		spy.mockRestore();

		expect(res.status).toBe(500);
		expect(await Client.countDocuments({ assignedBroker: leaving._id })).toBe(3);
		expect(await AuditLog.countDocuments({ action: { $in: ["client.update", "user.clients_reassigned"] } })).toBe(0);
	});
});

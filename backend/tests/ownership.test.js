const { request, makeUser, authHeader } = require("./factories");
const Client = require("../models/Client");
const OwnershipClaim = require("../models/OwnershipClaim");
const AuditLog = require("../models/AuditLog");
const audit = require("../services/auditService");

const createClient = (user, body) =>
	request()
		.post("/api/clients")
		.set(authHeader(user))
		.send({ requirements: { city: "Patna" }, ...body });

describe("client ownership protection", () => {
	test("the same number in another format is recognised as the same buyer", async () => {
		const first = await makeUser({ name: "First Broker" });
		const second = await makeUser({ name: "Second Broker" });

		const original = await createClient(first, { name: "Rahul Sinha", phone: "98765 43210", email: "rahul@example.com" });
		expect(original.status).toBe(201);
		expect(original.body.data.phoneKey).toBe("+919876543210");

		const duplicate = await createClient(second, { name: "Rahul S", phone: "+91-98765-43210" });
		expect(duplicate.status).toBe(409);
		expect(duplicate.body.code).toBe("CLIENT_ALREADY_REGISTERED");
		expect(await Client.countDocuments()).toBe(1);
	});

	test("the claimant learns only that the client exists and when it was registered", async () => {
		const first = await makeUser({ name: "First Broker" });
		const second = await makeUser({ name: "Second Broker" });
		await createClient(first, { name: "Rahul Sinha", phone: "9876543210", email: "rahul@example.com" });

		const res = await createClient(second, { name: "Rahul", phone: "09876543210" });
		expect(Object.keys(res.body.details).sort()).toEqual(["claimId", "registeredAt"]);
		const raw = JSON.stringify(res.body);
		for (const secret of ["Rahul Sinha", "rahul@example.com", "First Broker", first.email, first._id.toString(), "CL-"]) {
			expect(raw).not.toContain(secret);
		}
	});

	test("a duplicate attempt opens one claim with audit evidence; repeats reuse it", async () => {
		const first = await makeUser();
		const second = await makeUser();
		const original = await createClient(first, { name: "Asha", phone: "9123456780" });

		await createClient(second, { name: "Asha K", phone: "9123456780" });
		await createClient(second, { name: "Asha K", phone: "+919123456780" });

		const claims = await OwnershipClaim.find().lean();
		expect(claims).toHaveLength(1);
		expect(claims[0]).toMatchObject({ status: "open", phoneKey: "+919123456780", submitted: { name: "Asha K" } });
		expect(claims[0].existingClient.toString()).toBe(original.body.data._id);

		const firstEntry = await AuditLog.findOne({ action: "client.create" }).lean();
		expect(claims[0].evidence.firstAuditSeq).toBe(firstEntry.seq);
		expect(claims[0].evidence.firstAuditHash).toBe(firstEntry.hash);
		expect(await AuditLog.countDocuments({ action: "ownership_claim.create" })).toBe(1);
	});

	test("two brokers registering the same buyer at the same moment: one 201, one 409", async () => {
		for (let round = 0; round < 10; round += 1) {
			const a = await makeUser();
			const b = await makeUser();
			const phone = `97000${String(round).padStart(5, "0")}`;
			const results = await Promise.all([
				createClient(a, { name: `Race ${round} A`, phone }),
				createClient(b, { name: `Race ${round} B`, phone: `+91 ${phone}` }),
			]);
			expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
			expect(await Client.countDocuments({ phoneKey: `+91${phone}` })).toBe(1);
		}
		expect(await audit.verifyChain()).toMatchObject({ ok: true });
	});

	test("registering your own client twice points you to it and opens no claim", async () => {
		const broker = await makeUser();
		const original = await createClient(broker, { name: "Neha", phone: "9988776655" });
		const again = await createClient(broker, { name: "Neha", phone: "9988776655" });
		expect(again.status).toBe(409);
		expect(again.body.details.clientId).toBe(original.body.data._id);
		expect(await OwnershipClaim.countDocuments()).toBe(0);
	});

	test("invalid numbers are rejected before anything is stored", async () => {
		const broker = await makeUser();
		const res = await createClient(broker, { name: "Bad", phone: "12345" });
		expect(res.status).toBe(400);
		expect(await Client.countDocuments()).toBe(0);
	});

	test("changing a client's phone to another client's number is refused", async () => {
		const broker = await makeUser();
		const a = await createClient(broker, { name: "A", phone: "9811100001" });
		await createClient(broker, { name: "B", phone: "9811100002" });
		const res = await request()
			.patch(`/api/clients/${a.body.data._id}`)
			.set(authHeader(broker))
			.send({ phone: "+91 98111 00002" });
		expect(res.status).toBe(409);
		expect(res.body.code).toBe("CLIENT_ALREADY_REGISTERED");
	});

	test("a deleted client's number can be registered again", async () => {
		const admin = await makeUser({ role: "admin" });
		const broker = await makeUser();
		const old = await createClient(broker, { name: "Gone", phone: "9800000009" });
		await request().delete(`/api/clients/${old.body.data._id}`).set(authHeader(admin));
		expect((await createClient(broker, { name: "Back", phone: "9800000009" })).status).toBe(201);
	});
});

describe("ownership claims (admin)", () => {
	const setup = async () => {
		const admin = await makeUser({ role: "admin" });
		const owner = await makeUser({ name: "Owner Broker" });
		const claimant = await makeUser({ name: "Claimant Broker" });
		const original = await createClient(owner, { name: "Divya", phone: "9345678901" });
		const attempt = await createClient(claimant, { name: "Divya N", phone: "9345678901" });
		return { admin, owner, claimant, clientId: original.body.data._id, claimId: attempt.body.details.claimId };
	};

	test("brokers can't see or resolve claims", async () => {
		const { owner, claimId } = await setup();
		expect((await request().get("/api/ownership-claims").set(authHeader(owner))).status).toBe(403);
		expect(
			(await request().post(`/api/ownership-claims/${claimId}/resolve`).set(authHeader(owner)).send({ decision: "transfer" })).status,
		).toBe(403);
	});

	test("admin sees both brokers and the existing client", async () => {
		const { admin } = await setup();
		const res = await request().get("/api/ownership-claims?status=open").set(authHeader(admin));
		expect(res.body.data).toHaveLength(1);
		expect(res.body.data[0]).toMatchObject({
			existingClient: { name: "Divya" },
			existingBroker: { name: "Owner Broker" },
			claimant: { name: "Claimant Broker" },
		});
	});

	test("keep leaves the client with its broker", async () => {
		const { admin, owner, clientId, claimId } = await setup();
		const res = await request()
			.post(`/api/ownership-claims/${claimId}/resolve`)
			.set(authHeader(admin))
			.send({ decision: "keep", note: "Owner registered first" });
		expect(res.body.data.status).toBe("upheld");
		expect((await Client.findById(clientId)).assignedBroker.toString()).toBe(owner._id.toString());
		expect(await AuditLog.countDocuments({ action: "ownership_claim.upheld" })).toBe(1);
	});

	test("transfer reassigns the client in the same transaction, audited, exactly once", async () => {
		const { admin, claimant, clientId, claimId } = await setup();
		const resolve = () =>
			request().post(`/api/ownership-claims/${claimId}/resolve`).set(authHeader(admin)).send({ decision: "transfer" });

		const results = await Promise.all([resolve(), resolve(), resolve()]);
		expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409]);

		expect((await Client.findById(clientId)).assignedBroker.toString()).toBe(claimant._id.toString());
		const update = await AuditLog.findOne({ action: "client.update", entityId: clientId }).lean();
		expect(update.after).toEqual({ assignedBroker: claimant._id.toString() });
		expect(await AuditLog.countDocuments({ action: "ownership_claim.transferred" })).toBe(1);
		expect(await audit.verifyChain()).toMatchObject({ ok: true });
	});

	test("a transfer to a deactivated broker fails and leaves the claim open", async () => {
		const { admin, claimant, clientId, claimId } = await setup();
		claimant.isActive = false;
		await claimant.save();
		const res = await request()
			.post(`/api/ownership-claims/${claimId}/resolve`)
			.set(authHeader(admin))
			.send({ decision: "transfer" });
		expect(res.status).toBe(400);
		expect((await OwnershipClaim.findById(claimId)).status).toBe("open");
		expect((await Client.findById(clientId)).assignedBroker.toString()).not.toBe(claimant._id.toString());
	});
});

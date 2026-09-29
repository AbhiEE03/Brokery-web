const { request, makeUser, makeClient, makeProperty, authHeader } = require("./factories");
const Client = require("../models/Client");

const get = (user, path) => request().get(path).set(authHeader(user));

describe("edit policies", () => {
	test("lists direct and approval fields per entity; admins apply directly", async () => {
		const broker = await makeUser();
		const admin = await makeUser({ role: "admin" });

		const res = await get(broker, "/api/meta/edit-policies");
		expect(res.status).toBe(200);
		expect(res.body.data.appliesDirectly).toBe(false);
		expect(res.body.data.client.direct).toContain("phone");
		expect(res.body.data.client.approval).toContain("requirements.maxBudget");
		expect(res.body.data.property.approval).toContain("pricing.askingPrice");

		expect((await get(admin, "/api/meta/edit-policies")).body.data.appliesDirectly).toBe(true);
		expect((await request().get("/api/meta/edit-policies")).status).toBe(401);
	});
});

describe("change request views", () => {
	test("resolved = everything but pending; conflicts carry the current values", async () => {
		const admin = await makeUser({ role: "admin" });
		const broker = await makeUser();
		const client = await makeClient({ broker });

		const proposed = await request()
			.patch(`/api/clients/${client._id}`)
			.set(authHeader(broker))
			.send({ requirements: { maxBudget: 9500000 } });
		// Someone else changes the field before the admin decides.
		await Client.updateOne({ _id: client._id }, { "requirements.maxBudget": 9200000 });
		await request().post(`/api/change-requests/${proposed.body.data.pending._id}/approve`).set(authHeader(admin)).send({});

		await request().patch(`/api/clients/${client._id}`).set(authHeader(broker)).send({ pipelineStage: "contacted" });

		const pending = await get(admin, "/api/change-requests?status=pending");
		const resolved = await get(admin, "/api/change-requests?status=resolved");
		expect(pending.body.data.map((c) => c.status)).toEqual(["pending"]);
		expect(resolved.body.data.map((c) => c.status)).toEqual(["conflict"]);
		expect(resolved.body.data[0].changes[0]).toMatchObject({ oldValue: 9000000, newValue: 9500000 });
		expect(resolved.body.data[0].currentValues).toEqual({ "requirements.maxBudget": 9200000 });
	});
});

describe("record history", () => {
	const setup = async () => {
		const admin = await makeUser({ role: "admin" });
		const owner = await makeUser();
		const other = await makeUser();
		const created = await request()
			.post("/api/clients")
			.set(authHeader(owner))
			.send({ name: "History Client", phone: "9876500001", requirements: { city: "Pune" } });
		const id = created.body.data._id;
		// An admin action on the same client, and a duplicate attempt by another broker.
		await request().patch(`/api/clients/${id}`).set(authHeader(admin)).send({ pipelineStage: "contacted" });
		await request().post("/api/clients").set(authHeader(other)).send({ name: "Dup", phone: "9876500001" });
		return { admin, owner, other, id };
	};

	test("the owning broker sees everyone's actions on their client, except ownership claims", async () => {
		const { owner, id } = await setup();
		const res = await get(owner, `/api/activity/entity/${id}`);
		expect(res.status).toBe(200);
		expect(res.body.data.map((e) => e.actionCode)).toEqual(["client.update", "client.create"]);
	});

	test("admins also see the ownership claim", async () => {
		const { admin, id } = await setup();
		const res = await get(admin, `/api/activity/entity/${id}`);
		expect(res.body.data.map((e) => e.actionCode)).toEqual(["ownership_claim.create", "client.update", "client.create"]);
	});

	test("another broker can't read the history of a client they don't own; property history is shared", async () => {
		const { other, id } = await setup();
		expect((await get(other, `/api/activity/entity/${id}`)).status).toBe(403);

		const property = await makeProperty();
		expect((await get(other, `/api/activity/entity/${property._id}`)).status).toBe(200);
		expect((await get(other, "/api/activity/entity/64b000000000000000000000")).status).toBe(404);
	});
});

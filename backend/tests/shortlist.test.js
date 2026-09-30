const { request, makeUser, makeClient, makeProperty, authHeader } = require("./factories");
const ShortlistLink = require("../models/ShortlistLink");
const Match = require("../models/Match");
const Alert = require("../models/Alert");
const AuditLog = require("../models/AuditLog");
const audit = require("../services/auditService");

const setup = async () => {
	const broker = await makeUser({ name: "Tiya" });
	const other = await makeUser();
	const admin = await makeUser({ role: "admin" });
	const client = await makeClient({ broker, name: "Bhaskar Bora", phone: "9000000118", email: "bhaskar@example.com" });
	const a = await makeProperty({
		title: "3BHK Flat in Beltola",
		location: { city: "Guwahati", locality: "Beltola", pincode: "781028", sector: "S1" },
		pricing: { askingPrice: 7200000, pricePerSqft: 4966 },
		specs: { area: 1450, bedrooms: 3, bathrooms: 2, parking: true },
		dealer: { name: "Owner Das", phone: "9812345678", email: "owner@example.com" },
		images: [{ url: "https://img.example/beltola.jpg" }],
		addedBy: broker,
	});
	const b = await makeProperty({ title: "2BHK near Ganeshguri", location: { city: "Guwahati", locality: "Ganeshguri" } });
	const outsider = await makeProperty({ title: "Not on the link" });

	const created = await request()
		.post(`/api/clients/${client._id}/shortlists`)
		.set(authHeader(broker))
		.send({ propertyIds: [a._id, b._id] });
	const token = created.body.data?.url?.split("/s/")[1];
	return { broker, other, admin, client, a, b, outsider, created, token };
};

const view = (token) => request().get(`/api/public/shortlists/${token}`);
const react = (token, body) => request().post(`/api/public/shortlists/${token}/feedback`).send(body);

describe("creating shortlist links", () => {
	test("returns the URL once and stores only the token's hash", async () => {
		const { created, token } = await setup();
		expect(created.status).toBe(201);
		expect(created.body.data.url).toMatch(/\/s\/[A-Za-z0-9_-]{43}$/);

		const stored = await ShortlistLink.findOne().lean();
		expect(JSON.stringify(stored)).not.toContain(token);
		expect(stored.tokenHash).toMatch(/^[a-f0-9]{64}$/);
		expect(await AuditLog.countDocuments({ action: "shortlist.create" })).toBe(1);
	});

	test("only the client's broker (or an admin) can share, and only real properties", async () => {
		const { other, broker, client } = await setup();
		const property = await makeProperty();
		const denied = await request().post(`/api/clients/${client._id}/shortlists`).set(authHeader(other)).send({ propertyIds: [property._id] });
		expect(denied.status).toBe(403);
		const unknown = await request()
			.post(`/api/clients/${client._id}/shortlists`)
			.set(authHeader(broker))
			.send({ propertyIds: ["64b000000000000000000000"] });
		expect(unknown.status).toBe(400);
	});
});

describe("the buyer's public view", () => {
	test("shows an allow-listed view only: no dealer, internal fields or client details", async () => {
		const { token } = await setup();
		const res = await view(token);
		expect(res.status).toBe(200);
		expect(res.headers["cache-control"]).toBe("no-store");
		expect(res.body.data).toMatchObject({ buyerFirstName: "Bhaskar", brokerName: "Tiya" });

		const [first] = res.body.data.properties;
		expect(Object.keys(first).sort()).toEqual(["_id", "feedback", "images", "location", "price", "propertyType", "specs", "status", "title"]);
		expect(first).toMatchObject({ title: "3BHK Flat in Beltola", price: 7200000, location: { city: "Guwahati", locality: "Beltola" } });
		expect(Object.keys(first.location)).toEqual(["city", "locality"]);
		expect(first.images).toEqual(["https://img.example/beltola.jpg"]);

		const raw = JSON.stringify(res.body);
		for (const secret of ["Owner Das", "9812345678", "owner@example.com", "9000000118", "bhaskar@example.com", "Bora", "781028", "propertyCode", "addedBy"]) {
			expect(raw).not.toContain(secret);
		}
	});

	test("counts opens", async () => {
		const { token } = await setup();
		await view(token);
		await view(token);
		const link = await ShortlistLink.findOne().lean();
		expect(link.openCount).toBe(2);
		expect(link.firstOpenedAt).toBeTruthy();
	});

	test("malformed, unknown, expired and revoked links all look the same: 404", async () => {
		const { token, broker } = await setup();
		const bodies = [];
		for (const bad of ["abc", "x".repeat(43), "A".repeat(43)]) {
			const res = await view(bad);
			expect(res.status).toBe(404);
			bodies.push(res.body.message);
		}
		await ShortlistLink.updateOne({}, { expiresAt: new Date(Date.now() - 1000) });
		expect((await view(token)).status).toBe(404);

		await ShortlistLink.updateOne({}, { expiresAt: new Date(Date.now() + 86400000) });
		const link = await ShortlistLink.findOne();
		await request().delete(`/api/shortlists/${link._id}`).set(authHeader(broker));
		const revoked = await view(token);
		expect(revoked.status).toBe(404);
		expect(new Set([...bodies, revoked.body.message]).size).toBe(1);
	});
});

describe("buyer feedback", () => {
	test("a like creates a high-interest match, alerts the broker and is audited", async () => {
		const { token, a, client, broker } = await setup();
		const res = await react(token, { propertyId: a._id, reaction: "like", comment: "Love the balcony" });
		expect(res.status).toBe(200);
		expect(res.body.data).toEqual({ changed: true, reaction: "like" });

		const match = await Match.findOne({ client: client._id, property: a._id }).lean();
		expect(match.interestLevel).toBe("high");
		const alert = await Alert.findOne().lean();
		expect(alert).toMatchObject({ kind: "shortlist_feedback", title: "Bhaskar Bora liked 3BHK Flat in Beltola", body: "“Love the balcony”" });
		expect(alert.user.toString()).toBe(broker._id.toString());
		const entry = await AuditLog.findOne({ action: "shortlist.feedback" }).lean();
		expect(entry).toMatchObject({ actor: null, meta: { via: "buyer-link" } });
		expect(await audit.verifyChain()).toMatchObject({ ok: true });

		expect((await view(token)).body.data.properties[0].feedback).toEqual({ reaction: "like", comment: "Love the balcony" });
	});

	test("repeated taps are idempotent; changing your mind updates the match", async () => {
		const { token, a, client } = await setup();
		await react(token, { propertyId: a._id, reaction: "like" });
		const again = await react(token, { propertyId: a._id, reaction: "like" });
		expect(again.body.data.changed).toBe(false);
		expect(await Alert.countDocuments()).toBe(1);
		expect(await AuditLog.countDocuments({ action: "shortlist.feedback" })).toBe(1);

		await react(token, { propertyId: a._id, reaction: "dislike" });
		expect((await Match.findOne({ client: client._id, property: a._id })).interestLevel).toBe("low");
		expect(await Alert.countDocuments()).toBe(2);
		expect(await Match.countDocuments({ client: client._id, property: a._id })).toBe(1);
	});

	test("a link can't carry feedback about properties it doesn't include", async () => {
		const { token, outsider } = await setup();
		const res = await react(token, { propertyId: outsider._id, reaction: "like" });
		expect(res.status).toBe(404);
		expect(await Match.countDocuments({ property: outsider._id })).toBe(0);
	});

	test("invalid reactions are rejected", async () => {
		const { token, a } = await setup();
		expect((await react(token, { propertyId: a._id, reaction: "buy-now" })).status).toBe(400);
	});
});

describe("managing links", () => {
	test("only the creator, the client's broker or an admin can revoke; the list hides token hashes", async () => {
		const { other, admin, broker, client } = await setup();
		const link = await ShortlistLink.findOne();
		expect((await request().delete(`/api/shortlists/${link._id}`).set(authHeader(other))).status).toBe(403);
		expect((await request().delete(`/api/shortlists/${link._id}`).set(authHeader(admin))).status).toBe(200);

		const list = await request().get(`/api/clients/${client._id}/shortlists`).set(authHeader(broker));
		expect(list.body.data[0]).toMatchObject({ status: "revoked" });
		expect(list.body.data[0].tokenHash).toBeUndefined();
		expect(list.body.data[0].properties[0]).toHaveProperty("title");
	});
});

test("adding a note to the same reaction is recorded as a note, not a second 'liked'", async () => {
	const { token, a } = await setup();
	await react(token, { propertyId: a._id, reaction: "like" });
	await react(token, { propertyId: a._id, reaction: "like", comment: "Saturday?" });
	const titles = (await Alert.find().sort({ createdAt: 1 }).lean()).map((alert) => alert.title);
	expect(titles).toEqual(["Bhaskar Bora liked 3BHK Flat in Beltola", "Bhaskar Bora added a note on 3BHK Flat in Beltola"]);
});

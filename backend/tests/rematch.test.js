const mongoose = require("mongoose");
const { request, makeUser, makeClient, authHeader } = require("./factories");
const Alert = require("../models/Alert");
const OutboxEvent = require("../models/OutboxEvent");
const Property = require("../models/Property");
const rematch = require("../services/rematchService");

const BANER_BUYER = { propertyType: "flat", city: "Pune", locality: "Baner", minBudget: 8000000, maxBudget: 10000000, bedrooms: 2 };

const setup = async () => {
	const admin = await makeUser({ role: "admin" });
	const broker = await makeUser({ name: "Pushpendu" });
	const other = await makeUser();
	const client = await makeClient({ broker, name: "Aditya Kulkarni", requirements: BANER_BUYER });
	// Another broker's client who wants something else entirely.
	await makeClient({ broker: other, requirements: { propertyType: "villa", city: "Pune", maxBudget: 30000000 } });

	const created = await request()
		.post("/api/properties")
		.set(authHeader(admin))
		.send({
			title: "2BHK Flat in Baner",
			propertyType: "flat",
			location: { city: "Pune", locality: "Baner" },
			pricing: { askingPrice: 12500000 },
			specs: { area: 1080, bedrooms: 2 },
		});
	await rematch.dispatchEvents(); // the "new listing" event: too expensive, nobody crosses
	const property = created.body.data;
	const edit = (patch) => request().patch(`/api/properties/${property._id}`).set(authHeader(admin)).send(patch);
	return { admin, broker, other, client, property, edit };
};

describe("re-match alerts", () => {
	test("a price drop into a client's budget alerts that client's broker exactly once", async () => {
		const { broker, client, edit } = await setup();
		expect(await Alert.countDocuments()).toBe(0);

		await edit({ pricing: { askingPrice: 9500000 } });
		expect(await OutboxEvent.countDocuments({ "payload.reason": "updated" })).toBe(1);
		await rematch.dispatchEvents();

		const alerts = await Alert.find().lean();
		expect(alerts).toHaveLength(1);
		expect(alerts[0]).toMatchObject({
			kind: "new_match",
			title: "New match for Aditya Kulkarni: 2BHK Flat in Baner",
			href: `/clients/${client._id}`,
		});
		expect(alerts[0].body).toMatch(/^Price dropped from ₹1.25 Cr to ₹95 L · \d+% match$/);
		expect(alerts[0].user.toString()).toBe(broker._id.toString());
		expect(await OutboxEvent.countDocuments({ status: "done" })).toBe(2);
	});

	test("reprocessing the same event never duplicates alerts", async () => {
		const { edit } = await setup();
		await edit({ pricing: { askingPrice: 9500000 } });
		await rematch.dispatchEvents();
		const event = await OutboxEvent.findOne({ "payload.reason": "updated" });
		await rematch.processEvent(event);
		await rematch.processEvent(event);
		expect(await Alert.countDocuments()).toBe(1);
	});

	test("a price increase, or a change that doesn't affect matching, alerts nobody", async () => {
		const { edit } = await setup();
		await edit({ pricing: { askingPrice: 9500000 } });
		await rematch.dispatchEvents();

		await edit({ pricing: { askingPrice: 9900000 } }); // still a match, but not a new one
		await edit({ title: "Renamed listing" }); // not a matching field: no event at all
		await rematch.dispatchEvents();
		expect(await Alert.countDocuments()).toBe(1);
		expect(await OutboxEvent.countDocuments()).toBe(3);
	});

	test("a rolled-back change leaves no event behind", async () => {
		const { property } = await setup();
		const before = await OutboxEvent.countDocuments();
		await expect(
			mongoose.connection.transaction(async (session) => {
				const doc = await Property.findById(property._id).session(session);
				const snapshot = rematch.matchingSnapshot(doc);
				doc.pricing.askingPrice = 9000000;
				await doc.save({ session });
				await rematch.emitPropertyChanged({ before: snapshot, after: doc, changedFields: ["pricing.askingPrice"], session });
				throw new Error("boom");
			}),
		).rejects.toThrow("boom");
		expect(await OutboxEvent.countDocuments()).toBe(before);
	});

	test("a worker that crashes mid-event is recovered and still alerts once", async () => {
		const { edit } = await setup();
		await edit({ pricing: { askingPrice: 9500000 } });
		// Crash: the event is claimed and its alerts written, but it is never marked done.
		const claimed = await OutboxEvent.findOneAndUpdate(
			{ status: "queued" },
			{ $set: { status: "processing" }, $inc: { attempts: 1 } },
			{ returnDocument: "after" },
		);
		await rematch.processEvent(claimed);
		await OutboxEvent.collection.updateOne({ _id: claimed._id }, { $set: { updatedAt: new Date(Date.now() - rematch.STUCK_AFTER_MS - 1000) } });

		expect(await rematch.reclaimStuckEvents()).toBe(1);
		await rematch.dispatchEvents();
		expect(await Alert.countDocuments()).toBe(1);
		expect((await OutboxEvent.findById(claimed._id)).status).toBe("done");
	});

	test("a failing event is retried with backoff and marked dead after 5 attempts", async () => {
		await setup();
		const event = await OutboxEvent.create({ type: "PropertyChanged", payload: { after: null } });
		for (let i = 0; i < 5; i += 1) {
			await OutboxEvent.updateOne({ _id: event._id }, { nextAttemptAt: new Date(0) });
			await rematch.dispatchEvents();
		}
		const final = await OutboxEvent.findById(event._id);
		expect(final.status).toBe("dead");
		expect(final.attempts).toBe(5);
		expect(final.lastError).toBeTruthy();
	});

	test("a new listing that fits, and a listing back on the market, both alert", async () => {
		const { admin, edit } = await setup();
		await request()
			.post("/api/properties")
			.set(authHeader(admin))
			.send({ title: "Fresh Baner flat", propertyType: "flat", location: { city: "Pune", locality: "Baner" }, pricing: { askingPrice: 9000000 }, specs: { bedrooms: 2 } });
		await rematch.dispatchEvents();
		expect((await Alert.findOne().lean()).body).toMatch(/^New listing · /);

		await edit({ pricing: { askingPrice: 9500000 } });
		await edit({ status: "sold" });
		await rematch.dispatchEvents();
		const count = await Alert.countDocuments();
		await edit({ status: "available" });
		await rematch.dispatchEvents();
		const latest = await Alert.findOne().sort({ createdAt: -1 }).lean();
		expect(await Alert.countDocuments()).toBe(count + 1);
		expect(latest.body).toMatch(/^Back on the market · /);
	});
});

describe("alerts API", () => {
	test("users see and update only their own alerts", async () => {
		const { broker, other, edit } = await setup();
		await edit({ pricing: { askingPrice: 9500000 } });
		await rematch.dispatchEvents();
		const mine = await request().get("/api/alerts?unread=1").set(authHeader(broker));
		expect(mine.body.data).toHaveLength(1);
		expect(mine.body.meta.unreadCount).toBe(1);
		expect((await request().get("/api/alerts").set(authHeader(other))).body.data).toHaveLength(0);

		const id = mine.body.data[0]._id;
		expect((await request().post(`/api/alerts/${id}/read`).set(authHeader(other))).status).toBe(404);
		expect((await request().post(`/api/alerts/${id}/read`).set(authHeader(broker))).status).toBe(200);
		expect((await request().get("/api/alerts?unread=1").set(authHeader(broker))).body.meta.unreadCount).toBe(0);
	});

	test("/readyz reports how long the oldest unprocessed event has waited", async () => {
		await setup();
		await OutboxEvent.create({ type: "PropertyChanged", payload: {}, createdAt: new Date(Date.now() - 20 * 60 * 1000) });
		const res = await request().get("/readyz");
		expect(res.status).toBe(200);
		expect(res.body.status).toBe("degraded");
		expect(res.body.outbox.oldestPendingSeconds).toBeGreaterThanOrEqual(1200);
	});
});

test("a listing that was over budget but otherwise perfect alerts when its price comes into range", async () => {
	const { client, edit } = await setup();
	// 20% over budget: ineligible, even though locality/BHK/freshness alone score ~65%.
	await edit({ pricing: { askingPrice: 12000000 } });
	await rematch.dispatchEvents();
	expect(await Alert.countDocuments()).toBe(0);

	await edit({ pricing: { askingPrice: 9900000 } });
	await rematch.dispatchEvents();
	const alerts = await Alert.find({ client: client._id }).lean();
	expect(alerts).toHaveLength(1);
	expect(alerts[0].body).toMatch(/^Price dropped from ₹1.2 Cr to ₹99 L/);
});

const {
	request,
	makeUser,
	makeClient,
	makeProperty,
	makeMatch,
	authHeader,
} = require("./factories");
const Client = require("../models/Client");
const Match = require("../models/Match");
const ChangeRequest = require("../models/ChangeRequest");
const StageTransition = require("../models/StageTransition");
const ActivityLog = require("../models/ActivityLog");

const DAY = 24 * 60 * 60 * 1000;
const get = (user, path) => request().get(path).set(authHeader(user));

describe("stage history", () => {
	test("create, direct admin edits and approvals each record a transition", async () => {
		const admin = await makeUser({ role: "admin" });
		const broker = await makeUser();

		const created = await request()
			.post("/api/clients")
			.set(authHeader(broker))
			.send({ name: "History", phone: "9811111111" });
		const id = created.body.data._id;

		await request().patch(`/api/clients/${id}`).set(authHeader(broker)).send({ pipelineStage: "contacted" });
		const cr = await ChangeRequest.findOne();
		await request().post(`/api/change-requests/${cr._id}/approve`).set(authHeader(admin)).send({});
		await request().patch(`/api/clients/${id}`).set(authHeader(admin)).send({ pipelineStage: "site_visit" });

		const rows = await StageTransition.find({ client: id }).sort({ at: 1 }).lean();
		expect(rows.map((r) => [r.from, r.to, r.via])).toEqual([
			[null, "lead", "create"],
			["lead", "contacted", "change_request"],
			["contacted", "site_visit", "direct"],
		]);
	});
});

describe("analytics", () => {
	const monthsAgo = (n) => {
		const d = new Date();
		return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - n, 15));
	};

	const setupFixture = async () => {
		const admin = await makeUser({ role: "admin" });
		const a = await makeUser({ name: "Asha" });
		const b = await makeUser({ name: "Bala" });
		const specs = [
			{ broker: a, path: ["lead", "contacted", "closed"], closedMonthsAgo: 1 },
			{ broker: a, path: ["lead", "contacted", "site_visit", "negotiation", "closed"], closedMonthsAgo: 1 },
			{ broker: a, path: ["lead", "lost"] },
			{ broker: b, path: ["lead", "contacted", "closed"], closedMonthsAgo: 3 },
			{ broker: b, path: ["lead"] },
			{ broker: null, path: ["lead", "contacted"] },
		];

		for (const spec of specs) {
			const stage = spec.path[spec.path.length - 1];
			const client = await makeClient({ broker: spec.broker, pipelineStage: stage });
			// Two days per stage, ending at the close date (or 5 months ago).
			const end = spec.closedMonthsAgo !== undefined ? monthsAgo(spec.closedMonthsAgo) : monthsAgo(5);
			await StageTransition.insertMany(
				spec.path.map((to, i) => ({
					client: client._id,
					from: i ? spec.path[i - 1] : null,
					to,
					via: "seed",
					at: new Date(end.getTime() - (spec.path.length - 1 - i) * 2 * DAY),
				})),
			);
		}
		return { admin };
	};

	test("deals by month counts closures in the month they happened, with empty months as 0", async () => {
		const { admin } = await setupFixture();
		const res = await get(admin, "/api/analytics/deals-by-month");

		expect(res.body.data).toHaveLength(12);
		const counts = res.body.data.map((m) => m.count);
		expect(counts[10]).toBe(2); // one month ago
		expect(counts[8]).toBe(1); // three months ago
		expect(counts.reduce((x, y) => x + y, 0)).toBe(3);
	});

	test("broker conversion uses resolved clients only and keeps unassigned clients", async () => {
		const { admin } = await setupFixture();
		const res = await get(admin, "/api/analytics/broker-performance");
		const byName = Object.fromEntries(res.body.data.map((r) => [r.brokerName, r]));

		expect(byName.Asha).toMatchObject({ total: 3, closed: 2, lost: 1, open: 0, conversionRate: 66.7 });
		expect(byName.Bala).toMatchObject({ total: 2, closed: 1, lost: 0, open: 1, conversionRate: 100 });
		expect(byName.Unassigned).toMatchObject({ total: 1, conversionRate: null });
	});

	test("funnel is cumulative: reaching a later stage counts as passing earlier ones", async () => {
		const { admin } = await setupFixture();
		const res = await get(admin, "/api/analytics/funnel");
		const reached = Object.fromEntries(res.body.data.map((r) => [r.stage, r.clients]));

		// Two closed clients skipped site_visit/negotiation but still passed them.
		expect(reached).toEqual({ lead: 6, contacted: 4, site_visit: 3, negotiation: 3, closed: 3 });
		expect(res.body.data.find((r) => r.stage === "contacted").fromPrevious).toBe(66.7);
	});

	test("time in stage reports the median of completed stays", async () => {
		const { admin } = await setupFixture();
		const res = await get(admin, "/api/analytics/time-in-stage");
		const lead = res.body.data.find((r) => r.stage === "lead");

		expect(lead).toMatchObject({ medianDays: 2, samples: 5 });
	});

	test("summary separates total inventory from available listings", async () => {
		const admin = await makeUser({ role: "admin" });
		await makeProperty();
		await makeProperty({ status: "sold" });
		const res = await get(admin, "/api/analytics/summary");
		expect(res.body.data).toMatchObject({ totalProperties: 2, activeListings: 1, activeBrokers: 0 });
	});
});

describe("soft delete", () => {
	test("deleting a client hides it, removes its matches and closes its pending requests", async () => {
		const admin = await makeUser({ role: "admin" });
		const broker = await makeUser();
		const client = await makeClient({ broker });
		const property = await makeProperty({ addedBy: broker });
		await makeMatch({ client, property, createdBy: broker });
		await request().patch(`/api/clients/${client._id}`).set(authHeader(broker)).send({ pipelineStage: "contacted" });

		const res = await request().delete(`/api/clients/${client._id}`).set(authHeader(admin));
		expect(res.status).toBe(200);

		expect((await get(admin, `/api/clients/${client._id}`)).status).toBe(404);
		expect((await get(admin, "/api/clients")).body.data).toHaveLength(0);
		expect(await Match.countDocuments()).toBe(0);
		expect((await ChangeRequest.findOne()).status).toBe("withdrawn");

		const archived = await Client.findById(client._id).setOptions({ withDeleted: true });
		expect(archived.deletedAt).toBeInstanceOf(Date);
		expect(archived.deletedBy.toString()).toBe(admin._id.toString());
	});

	test("deleted records are excluded from analytics", async () => {
		const admin = await makeUser({ role: "admin" });
		const client = await makeClient();
		await makeClient();
		await request().delete(`/api/clients/${client._id}`).set(authHeader(admin));

		const res = await get(admin, "/api/analytics/summary");
		expect(res.body.data.totalClients).toBe(1);
	});
});

describe("filters and pagination", () => {
	test("city filters are case-insensitive", async () => {
		const broker = await makeUser();
		await makeProperty({ location: { city: "Mumbai" } });
		await makeProperty({ location: { city: "Delhi" } });

		const res = await get(broker, "/api/properties?city=mUMBAI");
		expect(res.body.data).toHaveLength(1);
		expect(res.body.data[0].location.city).toBe("Mumbai");
	});

	test("matches are paginated server-side", async () => {
		const broker = await makeUser();
		const client = await makeClient({ broker });
		for (let i = 0; i < 3; i += 1) {
			await makeMatch({ client, property: await makeProperty(), createdBy: broker });
		}
		const res = await get(broker, "/api/matches?limit=2&page=2");
		expect(res.body.data).toHaveLength(1);
		expect(res.body.pagination).toMatchObject({ page: 2, limit: 2, total: 3, pages: 2 });
	});

	describe("activity log", () => {
		const seedLogs = async () => {
			const admin = await makeUser({ role: "admin" });
			const a = await makeUser();
			const b = await makeUser();
			const base = new Date("2026-09-01T10:00:00Z").getTime();
			await ActivityLog.insertMany(
				Array.from({ length: 7 }, (_, i) => ({
					performedBy: i % 2 ? a._id : b._id,
					action: `action ${i}`,
					entity: i < 4 ? "client" : "property",
					createdAt: new Date(base + i * DAY),
				})),
			);
			return { admin, a, b };
		};

		test("filters by entity, broker and date range on the server", async () => {
			const { admin, a } = await seedLogs();
			const byEntity = await get(admin, "/api/activity?entityType=property");
			expect(byEntity.body.pagination.total).toBe(3);

			const byBroker = await get(admin, `/api/activity?broker=${a._id}`);
			expect(byBroker.body.data.every((l) => l.performedBy._id === a._id.toString())).toBe(true);

			const byDate = await get(admin, "/api/activity?from=2026-09-02&to=2026-09-03");
			expect(byDate.body.data.map((l) => l.action)).toEqual(["action 2", "action 1"]);
		});

		test("keyset cursor pages through every entry exactly once", async () => {
			const { admin } = await seedLogs();
			const seen = [];
			let cursor = null;
			do {
				const res = await get(admin, `/api/activity?limit=3${cursor ? `&cursor=${cursor}` : ""}`);
				seen.push(...res.body.data.map((l) => l.action));
				cursor = res.body.pagination.nextCursor;
			} while (cursor);

			expect(seen).toEqual(["action 6", "action 5", "action 4", "action 3", "action 2", "action 1", "action 0"]);
		});

		test("brokers can't read other brokers' activity via the broker filter", async () => {
			const { a, b } = await seedLogs();
			const res = await get(a, `/api/activity?broker=${b._id}`);
			expect(res.body.data.every((l) => l.performedBy._id === a._id.toString())).toBe(true);
		});
	});
});

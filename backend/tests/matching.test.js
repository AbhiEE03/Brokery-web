const { request, makeUser, makeClient, makeProperty, authHeader } = require("./factories");
const Match = require("../models/Match");
const RecommendationEvent = require("../models/RecommendationEvent");
const AuditLog = require("../models/AuditLog");
const { topK } = require("../utils/topK");
const { scoreMatch } = require("../services/matchingService");

const get = (user, path) => request().get(path).set(authHeader(user));
const post = (user, path, body = {}) => request().post(path).set(authHeader(user)).send(body);

describe("topK", () => {
	test("matches a full sort for random inputs, keeping the first-seen item on ties", () => {
		for (let run = 0; run < 50; run += 1) {
			const items = Array.from({ length: 200 }, (_, id) => ({ id, score: Math.floor(Math.random() * 20) }));
			const k = 1 + Math.floor(Math.random() * 30);
			const expected = [...items].sort((a, b) => b.score - a.score || a.id - b.id).slice(0, k);
			expect(topK(items, k)).toEqual(expected);
		}
		expect(topK([], 5)).toEqual([]);
		expect(topK([{ score: 1 }], 0)).toEqual([]);
	});
});

describe("scoreMatch", () => {
	const client = {
		requirements: { minBudget: 8000000, maxBudget: 9000000, locality: "Baner", bedrooms: 2, minArea: 900, maxArea: 1200 },
	};
	const now = Date.parse("2026-09-30T00:00:00Z");
	const property = (overrides = {}) => ({
		pricing: { askingPrice: 8500000 },
		location: { locality: "Baner" },
		specs: { bedrooms: 2, area: 1000 },
		createdAt: new Date(now),
		...overrides,
	});
	const feature = (result, name) => result.breakdown.find((f) => f.feature === name);

	test("a listing that fits everything today scores 1, with reasons", () => {
		const result = scoreMatch(client, property(), { now });
		expect(result.score).toBe(1);
		expect(feature(result, "budget").reason).toBe("Price ₹85 L within budget ₹80 L–₹90 L");
		expect(feature(result, "locality").reason).toBe("In Baner, the locality wanted");
		expect(feature(result, "bedrooms").reason).toBe("2 BHK as wanted");
	});

	test("budget fit decays to 0 at 10% over; locality and bedrooms explain misses", () => {
		const over = scoreMatch(client, property({ pricing: { askingPrice: 9450000 } }), { now });
		expect(feature(over, "budget").value).toBe(0.5);
		expect(feature(over, "budget").reason).toBe("Price ₹94.5 L is 5% over the ₹90 L budget");
		expect(feature(scoreMatch(client, property({ pricing: { askingPrice: 9900000 } }), { now }), "budget").value).toBe(0);

		const elsewhere = scoreMatch(client, property({ location: { locality: "Wakad" }, specs: { bedrooms: 3, area: 1000 } }), { now });
		expect(feature(elsewhere, "locality")).toMatchObject({ value: 0, reason: "In Wakad, not Baner" });
		expect(feature(elsewhere, "bedrooms")).toMatchObject({ value: 0.5, reason: "3 BHK, client wants 2 BHK" });
	});

	test("freshness halves every 30 days", () => {
		const old = scoreMatch(client, property({ createdAt: new Date(now - 30 * 86400000) }), { now });
		expect(feature(old, "freshness").value).toBe(0.5);
	});

	test("contributions add up to the score and are sorted largest first", () => {
		const result = scoreMatch(client, property({ location: { locality: "Kothrud" } }), { now });
		const sum = result.breakdown.reduce((total, f) => total + f.contribution, 0);
		expect(result.score).toBeCloseTo(sum, 3);
		const contributions = result.breakdown.map((f) => f.contribution);
		expect(contributions).toEqual([...contributions].sort((a, b) => b - a));
	});
});

describe("recommendations API", () => {
	const setup = async () => {
		const broker = await makeUser();
		const other = await makeUser();
		const admin = await makeUser({ role: "admin" });
		const client = await makeClient({
			broker,
			requirements: { propertyType: "flat", city: "Pune", locality: "Baner", minBudget: 8000000, maxBudget: 10000000, bedrooms: 2 },
		});
		const make = (title, overrides) =>
			makeProperty({ title, location: { city: "Pune", locality: "Baner" }, pricing: { askingPrice: 9000000 }, specs: { area: 1000, bedrooms: 2 }, ...overrides });
		const props = {
			perfect: await make("Perfect Baner 2BHK"),
			wakad: await make("Wakad 3BHK", { location: { city: "pune", locality: "Wakad" }, specs: { bedrooms: 3 }, pricing: { askingPrice: 10500000 } }),
			tooExpensive: await make("Too expensive", { pricing: { askingPrice: 11500000 } }),
			otherCity: await make("Mumbai flat", { location: { city: "Mumbai", locality: "Baner" } }),
			sold: await make("Sold flat", { status: "sold" }),
			villa: await make("Baner villa", { propertyType: "villa" }),
		};
		return { broker, other, admin, client, props };
	};

	test("ranks in-city available candidates best-first and filters out the rest", async () => {
		const { broker, client, props } = await setup();
		const res = await get(broker, `/api/clients/${client._id}/recommendations`);
		expect(res.status).toBe(200);
		expect(res.body.data.map((r) => r.property.title)).toEqual(["Perfect Baner 2BHK", "Wakad 3BHK"]);
		expect(res.body.data[0]).toMatchObject({ rank: 1 });
		expect(res.body.data[0].score).toBeGreaterThan(res.body.data[1].score);
		expect(res.body.data[1].breakdown.map((f) => f.reason)).toContain("Price ₹1.05 Cr is 5% over the ₹1 Cr budget");
		expect(res.body.meta.candidates).toBe(2);
		expect(props.wakad).toBeTruthy();
	});

	test("linking creates an audited match, records the event and drops it from recommendations", async () => {
		const { broker, client, props } = await setup();
		const link = await post(broker, `/api/clients/${client._id}/recommendations/${props.perfect._id}/link`, { rank: 1 });
		expect(link.status).toBe(201);
		expect(await Match.countDocuments({ client: client._id, property: props.perfect._id, interestLevel: "high" })).toBe(1);
		expect(await RecommendationEvent.findOne({ action: "linked" }).lean()).toMatchObject({ rank: 1 });
		expect((await AuditLog.findOne({ action: "match.create" }).lean()).summary).toMatch(/via recommendation/);

		const again = await post(broker, `/api/clients/${client._id}/recommendations/${props.perfect._id}/link`);
		expect(again.status).toBe(409);
		const res = await get(broker, `/api/clients/${client._id}/recommendations`);
		expect(res.body.data.map((r) => r.property.title)).toEqual(["Wakad 3BHK"]);
	});

	test("'not a fit' hides a property for that client, once", async () => {
		const { broker, client, props } = await setup();
		await post(broker, `/api/clients/${client._id}/recommendations/${props.perfect._id}/dismiss`);
		await post(broker, `/api/clients/${client._id}/recommendations/${props.perfect._id}/dismiss`);
		expect(await RecommendationEvent.countDocuments({ action: "dismissed" })).toBe(1);
		expect(await AuditLog.countDocuments({ action: "client.recommendation_dismissed" })).toBe(1);
		const res = await get(broker, `/api/clients/${client._id}/recommendations`);
		expect(res.body.data.map((r) => r.property.title)).toEqual(["Wakad 3BHK"]);
	});

	test("other brokers can't see or act on another broker's client", async () => {
		const { other, client, props } = await setup();
		expect((await get(other, `/api/clients/${client._id}/recommendations`)).status).toBe(403);
		expect((await post(other, `/api/clients/${client._id}/recommendations/${props.perfect._id}/link`)).status).toBe(403);
	});

	test("a client without a city gets an empty list and a hint", async () => {
		const broker = await makeUser();
		const client = await makeClient({ broker, requirements: { minBudget: 1, maxBudget: 2 } });
		const res = await get(broker, `/api/clients/${client._id}/recommendations`);
		expect(res.body.data).toEqual([]);
		expect(res.body.meta.hint).toMatch(/add a city/i);
	});

	test("interested clients: active clients only, and brokers see just their own", async () => {
		const { broker, other, admin, client, props } = await setup();
		await makeClient({
			broker: other,
			requirements: { propertyType: "flat", city: "Pune", locality: "Baner", minBudget: 8500000, maxBudget: 9500000, bedrooms: 2 },
		});
		await makeClient({ broker, pipelineStage: "lost", requirements: { city: "Pune", maxBudget: 10000000 } });

		const mine = await get(broker, `/api/properties/${props.perfect._id}/interested-clients`);
		expect(mine.body.data.map((r) => r.client._id)).toEqual([client._id.toString()]);
		const all = await get(admin, `/api/properties/${props.perfect._id}/interested-clients`);
		expect(all.body.data).toHaveLength(2);
	});
});

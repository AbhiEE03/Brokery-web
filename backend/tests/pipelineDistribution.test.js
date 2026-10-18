const { request, makeUser, makeClient, authHeader } = require("./factories");

const get = (user, path = "/api/analytics/pipeline-distribution") => request().get(path).set(authHeader(user));
const asMap = (res) => Object.fromEntries(res.body.data.map((row) => [row._id, row.count]));

// Two brokers' clients across several stages, one soft-deleted.
const setup = async () => {
	const admin = await makeUser({ role: "admin" });
	const asha = await makeUser({ name: "Asha" });
	const bala = await makeUser({ name: "Bala" });
	for (const [broker, stage, name] of [
		[asha, "lead", "Rahul Sinha"],
		[asha, "lead", "Rahul Verma"],
		[asha, "closed", "Priya Kumari"],
		[bala, "lead", "Rohan Joshi"],
		[bala, "negotiation", "Meera Patil"],
		[bala, "negotiation", "Rahul Nair"],
	]) {
		await makeClient({ broker, pipelineStage: stage, name });
	}
	const gone = await makeClient({ broker: bala, pipelineStage: "lost", name: "Deleted Dev" });
	await request().delete(`/api/clients/${gone._id}`).set(authHeader(admin));
	return { admin, asha, bala };
};

describe("GET /api/analytics/pipeline-distribution", () => {
	test("an admin gets the number of clients in each stage, all brokers together, soft-deleted ones excluded", async () => {
		const { admin } = await setup();
		const res = await get(admin);
		expect(res.status).toBe(200);
		expect(asMap(res)).toEqual({ lead: 3, closed: 1, negotiation: 2 });
	});

	test("a broker gets the counts for their own clients only", async () => {
		const { asha, bala } = await setup();
		const ashas = await get(asha);
		expect(ashas.status).toBe(200);
		expect(asMap(ashas)).toEqual({ lead: 2, closed: 1 });
		expect(asMap(await get(bala))).toEqual({ lead: 1, negotiation: 2 });
	});

	test("an admin can narrow the counts to one broker", async () => {
		const { admin, bala } = await setup();
		expect(asMap(await get(admin, `/api/analytics/pipeline-distribution?broker=${bala._id}`))).toEqual({ lead: 1, negotiation: 2 });
	});

	test("the same name search as the client list narrows the counts, so a filtered board can show true totals", async () => {
		const { admin, asha } = await setup();
		expect(asMap(await get(admin, "/api/analytics/pipeline-distribution?search=rahul"))).toEqual({ lead: 2, negotiation: 1 });
		// A broker's search still stays inside their own clients.
		expect(asMap(await get(asha, "/api/analytics/pipeline-distribution?search=rahul"))).toEqual({ lead: 2 });
	});

	test("a broker cannot use the broker filter to look at someone else's pipeline", async () => {
		const { asha, bala } = await setup();
		expect(asMap(await get(asha, `/api/analytics/pipeline-distribution?broker=${bala._id}`))).toEqual({ lead: 2, closed: 1 });
	});

	test("requires sign-in", async () => {
		expect((await get(null)).status).toBe(401);
	});
});

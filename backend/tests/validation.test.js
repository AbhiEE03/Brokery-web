const { request, makeUser, makeClient, authHeader } = require("./factories");
const User = require("../models/User");

describe("request validation", () => {
	test.each([
		["page=0", "/api/clients?page=0"],
		["limit too large", "/api/clients?limit=100000"],
		["non-numeric limit", "/api/clients?limit=abc"],
		["unknown stage", "/api/clients?stage=won"],
		["non-numeric price", "/api/properties?minPrice=cheap"],
	])("%s → 400", async (_, path) => {
		const broker = await makeUser();
		const res = await request().get(path).set(authHeader(broker));
		expect(res.status).toBe(400);
	});

	test.each([
		["client", "/api/clients/not-an-id"],
		["property", "/api/properties/123"],
		["activity entity", "/api/activity/entity/zzz"],
	])("malformed %s id → 400", async (_, path) => {
		const admin = await makeUser({ role: "admin" });
		const res = await request().get(path).set(authHeader(admin));
		expect(res.status).toBe(400);
	});

	test("search input is matched literally (no regex injection)", async () => {
		const broker = await makeUser();
		await makeClient({ broker, name: "Amit (NRI)" });
		await makeClient({ broker, name: "Amit Kumar" });
		const res = await request()
			.get(`/api/clients?search=${encodeURIComponent("Amit (")}`)
			.set(authHeader(broker));
		expect(res.status).toBe(200);
		expect(res.body.data.map((c) => c.name)).toEqual(["Amit (NRI)"]);
	});

	test("client budgets must be ordered", async () => {
		const broker = await makeUser();
		const res = await request()
			.post("/api/clients")
			.set(authHeader(broker))
			.send({
				name: "Budget",
				phone: "9811111111",
				requirements: { minBudget: 9000000, maxBudget: 8000000 },
			});
		expect(res.status).toBe(400);
	});
});

describe("login", () => {
	test("non-string credentials are rejected before querying", async () => {
		const res = await request()
			.post("/api/auth/login")
			.send({ email: { $ne: null }, password: "x" });
		expect(res.status).toBe(400);
	});

	test("wrong password → 401", async () => {
		const user = await makeUser();
		const res = await request()
			.post("/api/auth/login")
			.send({ email: user.email, password: "wrong" });
		expect(res.status).toBe(401);
	});

	test("disabled users cannot log in or use existing tokens", async () => {
		const user = await makeUser();
		const headers = authHeader(user);
		await User.updateOne({ _id: user._id }, { isActive: false });

		const login = await request()
			.post("/api/auth/login")
			.send({ email: user.email, password: "Password@123" });
		expect(login.status).toBe(403);

		const me = await request().get("/api/auth/me").set(headers);
		expect(me.status).toBe(401);
	});
});

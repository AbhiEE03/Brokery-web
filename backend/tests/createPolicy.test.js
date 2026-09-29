const { request, makeUser, authHeader } = require("./factories");

// Brokers must not be able to skip the approval workflow by setting sensitive
// fields at creation time (mass assignment).
describe("create-time field policy", () => {
	test("broker-created client always starts as a lead", async () => {
		const broker = await makeUser();
		const res = await request()
			.post("/api/clients")
			.set(authHeader(broker))
			.send({ name: "Mass Assign", phone: "9811111111", pipelineStage: "closed" });
		expect(res.status).toBe(201);
		expect(res.body.data.pipelineStage).toBe("lead");
	});

	test("broker-created property always starts as available", async () => {
		const broker = await makeUser();
		const res = await request()
			.post("/api/properties")
			.set(authHeader(broker))
			.send({ title: "Mass Assign", location: { city: "Delhi" }, status: "sold" });
		expect(res.status).toBe(201);
		expect(res.body.data.status).toBe("available");
	});
});

const { request } = require("./factories");
const { routes } = require("../openapi/routes");

const SAMPLE = { id: "64b000000000000000000001", propertyId: "64b000000000000000000002", clientId: "64b000000000000000000003", entityId: "64b000000000000000000004", token: "A".repeat(43) };

describe("API docs", () => {
	test("serve a valid-looking OpenAPI document", async () => {
		const res = await request().get("/api/openapi.json");
		expect(res.status).toBe(200);
		expect(res.body.openapi).toBe("3.1.0");
		expect(Object.keys(res.body.paths).length).toBe(new Set(routes.map((r) => r.path)).size);
		const create = res.body.paths["/clients"].post.requestBody.content["application/json"].schema;
		expect(create.required).toEqual(expect.arrayContaining(["name", "phone"]));
		expect(res.body.paths["/public/shortlists/{token}"].get.security).toEqual([]);
	});

	test("every documented route exists (none fall through to the 404 handler)", async () => {
		for (const route of routes) {
			const path = route.path.replace(/\{(\w+)\}/g, (_, name) => SAMPLE[name]);
			const res = await request()[route.method](`/api${path}`).send({});
			expect({ route: `${route.method.toUpperCase()} ${route.path}`, code: res.body.code }).not.toEqual({
				route: `${route.method.toUpperCase()} ${route.path}`,
				code: "NOT_FOUND",
			});
		}
	});

	test("the docs page loads Swagger UI under its own content security policy", async () => {
		const res = await request().get("/api/docs");
		expect(res.status).toBe(200);
		expect(res.text).toContain("swagger-ui-bundle.js");
		expect(res.headers["content-security-policy"]).toContain("https://cdn.jsdelivr.net");
		expect((await request().get("/api/clients")).headers["content-security-policy"]).not.toContain("cdn.jsdelivr.net");
	});
});

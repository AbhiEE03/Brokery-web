const {
	request,
	makeUser,
	makeProperty,
	authHeader,
	FILES,
} = require("./factories");
const Client = require("../models/Client");
const Notification = require("../models/Notification");
const { loadEnv } = require("../config/env");
const { reclaimStuck } = require("../services/notificationService");
const { createOutboxWorker } = require("../workers/outboxWorker");
const { buildChangeRequestEmail } = jest.requireActual("../utils/emailService");

describe("error responses", () => {
	test("unknown routes return JSON 404 with a request id", async () => {
		const res = await request().get("/api/nope");
		expect(res.status).toBe(404);
		expect(res.body).toMatchObject({ success: false, code: "NOT_FOUND" });
		expect(res.body.requestId).toBe(res.headers["x-request-id"]);
	});

	test("an incoming X-Request-Id is propagated", async () => {
		const res = await request().get("/api/nope").set("X-Request-Id", "trace-123");
		expect(res.headers["x-request-id"]).toBe("trace-123");
		expect(res.body.requestId).toBe("trace-123");
	});

	test("malformed JSON is a 400, not a 500", async () => {
		const res = await request()
			.post("/api/auth/login")
			.set("Content-Type", "application/json")
			.send('{"email": ');
		expect(res.status).toBe(400);
		expect(res.body.code).toBe("INVALID_JSON");
	});

	test("unexpected errors return a generic message without internals", async () => {
		const broker = await makeUser();
		jest.spyOn(Client, "find").mockImplementationOnce(() => {
			throw new Error("connection string mongodb://secret@host");
		});
		const res = await request().get("/api/clients").set(authHeader(broker));
		expect(res.status).toBe(500);
		expect(res.body.code).toBe("INTERNAL_ERROR");
		expect(JSON.stringify(res.body)).not.toContain("secret");
	});

	test("rejected file types return a JSON 400", async () => {
		const broker = await makeUser();
		const property = await makeProperty({ addedBy: broker });
		const res = await request()
			.post(`/api/properties/${property._id}/images`)
			.set(authHeader(broker))
			.attach("file", FILES.pdf, { filename: "a.pdf", contentType: "application/pdf" });
		expect(res.status).toBe(400);
		expect(res.body.code).toBe("UNSUPPORTED_FILE");
	});

	test("files over 5 MB return 413", async () => {
		const broker = await makeUser();
		const property = await makeProperty({ addedBy: broker });
		const big = Buffer.concat([FILES.png, Buffer.alloc(5 * 1024 * 1024 + 10)]);
		const res = await request()
			.post(`/api/properties/${property._id}/images`)
			.set(authHeader(broker))
			.attach("file", big, { filename: "big.png", contentType: "image/png" });
		expect(res.status).toBe(413);
		expect(res.body.code).toBe("FILE_TOO_LARGE");
	});
});

describe("security headers and health", () => {
	test("helmet headers are set", async () => {
		const res = await request().get("/healthz");
		expect(res.status).toBe(200);
		expect(res.headers["x-content-type-options"]).toBe("nosniff");
		expect(res.headers["x-powered-by"]).toBeUndefined();
	});

	test("readiness checks the database", async () => {
		const res = await request().get("/readyz");
		expect(res.status).toBe(200);
		expect(res.body.status).toBe("ready");
	});
});

describe("login rate limiting", () => {
	test("repeated failures for one account are throttled; other accounts are not", async () => {
		const user = await makeUser();
		const attempt = (email) =>
			request().post("/api/auth/login").send({ email, password: "wrong" });

		const statuses = [];
		for (let i = 0; i < 6; i += 1) statuses.push((await attempt(user.email)).status);
		expect(statuses).toEqual([401, 401, 401, 401, 401, 429]);

		expect((await attempt("someone-else@test.com")).status).toBe(401);
	});

	test("successful logins return the standard envelope", async () => {
		const user = await makeUser();
		const res = await request()
			.post("/api/auth/login")
			.send({ email: user.email, password: "Password@123" });
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(res.body.data.token).toEqual(expect.any(String));
		expect(res.body.data.user).toMatchObject({ email: user.email, role: "broker" });
		expect(res.body.data.user.password).toBeUndefined();
	});
});

describe("environment validation", () => {
	const base = {
		MONGO_URI: "mongodb://localhost/test",
		JWT_SECRET: "x".repeat(40),
		CLIENT_URL: "http://localhost:5173",
	};

	test("missing required variables fail fast with a clear message", () => {
		expect(() => loadEnv({ JWT_SECRET: "x" })).toThrow(/MONGO_URI/);
	});

	test("EMAIL_APP_PASSWORD is accepted as EMAIL_PASS", () => {
		const { env } = loadEnv({ ...base, EMAIL_USER: "a@b.com", EMAIL_APP_PASSWORD: "app-pass" });
		expect(env.EMAIL_PASS).toBe("app-pass");
	});

	test("weak JWT secrets produce a warning", () => {
		const { warnings } = loadEnv({ ...base, JWT_SECRET: "short" });
		expect(warnings.join(" ")).toMatch(/JWT_SECRET/);
	});
});

describe("emails", () => {
	test("user-provided values are HTML-escaped", () => {
		const { html } = buildChangeRequestEmail({
			brokerName: "<script>alert(1)</script>",
			entityType: "client",
			action: "rejected",
			adminNote: '<img src=x onerror="steal()">',
			changes: [{ field: "notes", oldValue: "<b>", newValue: "</ul>" }],
		});
		expect(html).not.toContain("<script>");
		expect(html).not.toContain("<img");
		expect(html).toContain("&lt;script&gt;");
	});
});

describe("outbox worker", () => {
	test("rows stuck in 'sending' after a crash are re-queued", async () => {
		const user = await makeUser();
		const stuck = await Notification.create({
			user: user._id,
			kind: "change_request_resolved",
			status: "sending",
		});
		await Notification.collection.updateOne(
			{ _id: stuck._id },
			{ $set: { updatedAt: new Date(Date.now() - 10 * 60 * 1000) } },
		);

		expect(await reclaimStuck()).toBe(1);
		expect((await Notification.findById(stuck._id)).status).toBe("queued");
	});

	test("overlapping ticks share one run", async () => {
		const worker = createOutboxWorker();
		const first = worker.tick();
		const second = worker.tick();
		expect(second).toBe(first);
		await first;
	});
});

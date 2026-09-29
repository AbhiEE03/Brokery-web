/**
 * Authorization matrix: every endpoint × actor with the status the API *should*
 * return. Actors: admin, owner (broker who owns the resource), other (another
 * broker), anon (no token).
 */
const {
	request,
	makeUser,
	makeClient,
	makeProperty,
	makeMatch,
	authHeader,
	FILES,
} = require("./factories");
const ClientChangeRequest = require("../models/ClientChangeRequest");

const buildFixture = async () => {
	const admin = await makeUser({ role: "admin" });
	const owner = await makeUser();
	const other = await makeUser();
	const client = await makeClient({ broker: owner });
	const otherClient = await makeClient({ broker: other });
	const property = await makeProperty({ addedBy: owner });
	const secondProperty = await makeProperty({ addedBy: owner });
	const match = await makeMatch({ client, property, createdBy: owner });
	const changeRequest = await ClientChangeRequest.create({
		client: client._id,
		requestedBy: owner._id,
		changes: [{ field: "pipelineStage", oldValue: "lead", newValue: "contacted" }],
	});
	return {
		actors: { admin, owner, other, anon: null },
		client,
		otherClient,
		property,
		secondProperty,
		match,
		changeRequest,
	};
};

// [description, method, path(fx), actor, expected, body?(fx), attach?]
const rows = [
	// auth
	["me requires a token", "get", () => "/api/auth/me", "anon", 401],
	["me works for brokers", "get", () => "/api/auth/me", "owner", 200],
	["register is admin-only", "post", () => "/api/auth/register", "owner", 403],
	["brokers list is admin-only", "get", () => "/api/auth/brokers", "owner", 403],
	["brokers list for admin", "get", () => "/api/auth/brokers", "admin", 200],

	// clients
	["clients list requires a token", "get", () => "/api/clients", "anon", 401],
	["owner reads own client", "get", (f) => `/api/clients/${f.client._id}`, "owner", 200],
	["other broker cannot read client", "get", (f) => `/api/clients/${f.client._id}`, "other", 403],
	["admin reads any client", "get", (f) => `/api/clients/${f.client._id}`, "admin", 200],
	["owner edits own client", "patch", (f) => `/api/clients/${f.client._id}`, "owner", 200, () => ({ phone: "9000000001" })],
	["other broker cannot edit client", "patch", (f) => `/api/clients/${f.client._id}`, "other", 403, () => ({ phone: "9000000001" })],
	["broker cannot delete client", "delete", (f) => `/api/clients/${f.client._id}`, "owner", 403],
	["admin deletes client", "delete", (f) => `/api/clients/${f.client._id}`, "admin", 200],
	["owner uploads client document", "post", (f) => `/api/clients/${f.client._id}/documents`, "owner", 200, null, "pdf"],
	["other broker cannot upload client document", "post", (f) => `/api/clients/${f.client._id}/documents`, "other", 403, null, "pdf"],

	// properties (inventory is shared for reading)
	["other broker reads property list", "get", () => "/api/properties", "other", 200],
	["other broker reads a property", "get", (f) => `/api/properties/${f.property._id}`, "other", 200],
	["owner edits own property", "patch", (f) => `/api/properties/${f.property._id}`, "owner", 200, () => ({ title: "Renamed" })],
	["admin edits any property", "patch", (f) => `/api/properties/${f.property._id}`, "admin", 200, () => ({ title: "Renamed" })],
	["other broker cannot edit property", "patch", (f) => `/api/properties/${f.property._id}`, "other", 403, () => ({ title: "Renamed" })],
	["broker cannot delete property", "delete", (f) => `/api/properties/${f.property._id}`, "owner", 403],
	["other broker cannot upload property image", "post", (f) => `/api/properties/${f.property._id}/images`, "other", 403, null, "png"],
	["owner uploads property image", "post", (f) => `/api/properties/${f.property._id}/images`, "owner", 200, null, "png"],

	// matches
	["other broker cannot list matches of a client", "get", (f) => `/api/matches/client/${f.client._id}`, "other", 403],
	["owner lists matches of own client", "get", (f) => `/api/matches/client/${f.client._id}`, "owner", 200],
	["other broker cannot link someone else's client", "post", () => "/api/matches", "other", 403, (f) => ({ client: f.client._id, property: f.secondProperty._id, interestLevel: "low" })],
	["owner links own client", "post", () => "/api/matches", "owner", 201, (f) => ({ client: f.client._id, property: f.secondProperty._id, interestLevel: "low" })],
	["other broker cannot edit match", "patch", (f) => `/api/matches/${f.match._id}`, "other", 403, () => ({ notes: "x" })],
	["other broker cannot delete match", "delete", (f) => `/api/matches/${f.match._id}`, "other", 403],

	// change requests
	["other broker cannot read change request", "get", (f) => `/api/change-requests/${f.changeRequest._id}`, "other", 403],
	["broker cannot resolve change request", "patch", (f) => `/api/change-requests/${f.changeRequest._id}/resolve`, "owner", 403, () => ({ action: "approved" })],

	// analytics & activity
	["analytics is admin-only", "get", () => "/api/analytics/summary", "owner", 403],
	["analytics for admin", "get", () => "/api/analytics/summary", "admin", 200],
	["activity requires a token", "get", () => "/api/activity", "anon", 401],
];

// Rows the current implementation gets wrong. Each is fixed in Phase 2 and
// then removed from this set (see docs/ENGINEERING_LOG.md).
const KNOWN_FAILURES = new Set([
	"other broker cannot upload client document",
	"other broker cannot edit property",
	"other broker cannot upload property image",
	"other broker cannot list matches of a client",
	"other broker cannot link someone else's client",
]);

describe("authorization matrix", () => {
	for (const [description, method, path, actor, expected, body, attach] of rows) {
		const run = KNOWN_FAILURES.has(description) ? test.failing : test;
		run(`${description} → ${expected}`, async () => {
			const fx = await buildFixture();
			let req = request()[method](path(fx)).set(authHeader(fx.actors[actor]));
			if (attach) {
				req = req.attach("file", FILES[attach], {
					filename: `file.${attach}`,
					contentType: attach === "pdf" ? "application/pdf" : "image/png",
				});
			} else if (body) {
				req = req.send(body(fx));
			}
			const res = await req;
			expect(res.status).toBe(expected);
		});
	}
});

describe("object-level data scoping", () => {
	// Known failure until Phase 2.
	test.failing("matches by property only include the broker's own links", async () => {
		const fx = await buildFixture();
		const res = await request()
			.get(`/api/matches/property/${fx.property._id}`)
			.set(authHeader(fx.actors.other));
		expect(res.status).toBe(200);
		expect(res.body.data).toHaveLength(0);
	});
});

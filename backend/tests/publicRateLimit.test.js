// Limits are read when the app is built, so set them before loading it.
process.env.PUBLIC_LINK_RATE_LIMIT_PER_MINUTE = "3";
// Behind a proxy, like production, so each X-Forwarded-For counts as a different client.
process.env.TRUST_PROXY = "1";

const { request } = require("./factories");

test("a single shortlist link is rate-limited, whatever IP it's hit from", async () => {
	const token = "A".repeat(43);
	const statuses = [];
	for (let i = 0; i < 5; i += 1) {
		statuses.push((await request().get(`/api/public/shortlists/${token}`).set("X-Forwarded-For", `10.0.0.${i}`)).status);
	}
	expect(statuses).toEqual([404, 404, 404, 429, 429]);

	// Other links are unaffected.
	expect((await request().get(`/api/public/shortlists/${"B".repeat(43)}`)).status).toBe(404);
});

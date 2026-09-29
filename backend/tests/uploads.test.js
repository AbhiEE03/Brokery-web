const { storeFile } = require("../utils/storage");
const {
	request,
	makeUser,
	makeClient,
	makeProperty,
	authHeader,
	FILES,
} = require("./factories");

const upload = (path, user, buffer, filename, contentType) =>
	request()
		.post(path)
		.set(authHeader(user))
		.attach("file", buffer, { filename, contentType });

describe("uploads", () => {
	test("client documents accept PDFs", async () => {
		const broker = await makeUser();
		const client = await makeClient({ broker });
		const res = await upload(`/api/clients/${client._id}/documents`, broker, FILES.pdf, "id.pdf", "application/pdf");
		expect(res.status).toBe(200);
		expect(res.body.data.documents).toHaveLength(1);
		expect(storeFile).toHaveBeenCalledTimes(1);
	});

	test("property images reject PDFs", async () => {
		const broker = await makeUser();
		const property = await makeProperty({ addedBy: broker });
		const res = await upload(`/api/properties/${property._id}/images`, broker, FILES.pdf, "a.pdf", "application/pdf");
		expect(res.status).toBeGreaterThanOrEqual(400);
		expect(storeFile).not.toHaveBeenCalled();
	});

	test("files whose content doesn't match the declared type are rejected", async () => {
		const broker = await makeUser();
		const property = await makeProperty({ addedBy: broker });
		const res = await upload(`/api/properties/${property._id}/images`, broker, FILES.fakePng, "a.png", "image/png");
		expect(res.status).toBe(400);
		expect(storeFile).not.toHaveBeenCalled();
	});

	// Known failure until Phase 2: authorization must run before the file is stored.
	test.failing("unauthorized uploads never reach storage", async () => {
		const owner = await makeUser();
		const other = await makeUser();
		const client = await makeClient({ broker: owner });
		const res = await upload(`/api/clients/${client._id}/documents`, other, FILES.pdf, "id.pdf", "application/pdf");
		expect(res.status).toBe(403);
		expect(storeFile).not.toHaveBeenCalled();
	});
});

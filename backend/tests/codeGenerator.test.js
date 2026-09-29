const { encodeLetters, decodeLetters } = require("../utils/codeGenerator");

describe("property code letters", () => {
	test.each([
		[0, "AA"],
		[1, "AB"],
		[25, "AZ"],
		[26, "BA"],
		[675, "ZZ"],
	])("encodes %i as %s and decodes back", (n, letters) => {
		expect(encodeLetters(n)).toBe(letters);
		expect(decodeLetters(letters)).toBe(n);
	});

	test("round-trips every value in range", () => {
		for (let n = 0; n <= 675; n += 1) {
			expect(decodeLetters(encodeLetters(n))).toBe(n);
		}
	});
});

describe("sequence-based codes", () => {
	const {
		encodePropertyCode,
		decodePropertyCode,
		nextPropertyCode,
	} = require("../utils/codeGenerator");
	const { request, makeUser, authHeader } = require("./factories");

	test.each([
		[1, "00AA"],
		[2, "00AB"],
		[676, "00ZZ"],
		[677, "01AA"],
		[67600, "99ZZ"],
		[67601, "100AA"],
	])("sequence %i ↔ %s", (seq, code) => {
		expect(encodePropertyCode(seq)).toBe(code);
		expect(decodePropertyCode(code)).toBe(seq);
	});

	test("50 concurrent property creations get 50 unique codes", async () => {
		const broker = await makeUser();
		const results = await Promise.all(
			Array.from({ length: 50 }, (_, i) =>
				request()
					.post("/api/properties")
					.set(authHeader(broker))
					.send({ title: `P${i}`, location: { city: "Delhi" } }),
			),
		);
		expect(results.every((r) => r.status === 201)).toBe(true);
		const codes = new Set(results.map((r) => r.body.data.propertyCode));
		expect(codes.size).toBe(50);
	});

	test("sequences are gap-free under concurrency", async () => {
		const codes = await Promise.all(Array.from({ length: 20 }, () => nextPropertyCode()));
		expect(new Set(codes).size).toBe(20);
	});
});

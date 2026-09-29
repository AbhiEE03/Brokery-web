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

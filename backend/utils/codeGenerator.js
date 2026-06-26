const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Encode 0-based number to 2-letter suffix (AA=0, AB=1, ..., ZZ=675)
 */
const encodeLetters = (n) => {
	const first = Math.floor(n / 26);
	const second = n % 26;
	return LETTERS[first] + LETTERS[second];
};

/**
 * Decode 2-letter code back to 0-based number (AA=0, AB=1, ..., ZZ=675)
 */
const decodeLetters = (s) => {
	return LETTERS.indexOf(s[0]) * 26 + LETTERS.indexOf(s[1]);
};

/**
 * Generate next sequential property code (format: XXYY where XX=numeric prefix, YY=letter suffix)
 * Sequence: 00AA → 00AB → ... → 00ZZ → 01AA → 01AB → ...
 */
const generateNextCode = async (Property) => {
	const last = await Property.findOne({}, { propertyCode: 1 })
		.sort({ propertyCode: -1 })
		.lean();

	if (!last || !last.propertyCode) return "00AA";

	const numPrefix = parseInt(last.propertyCode.slice(0, 2));
	const letterSuffix = last.propertyCode.slice(2);
	const letterIndex = decodeLetters(letterSuffix);

	if (letterIndex < 675) {
		return String(numPrefix).padStart(2, "0") + encodeLetters(letterIndex + 1);
	} else {
		return String(numPrefix + 1).padStart(2, "0") + "AA";
	}
};

module.exports = { generateNextCode, encodeLetters, decodeLetters };

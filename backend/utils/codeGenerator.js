const Counter = require("../models/Counter");

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const LETTER_SPACE = 26 * 26;

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
 * Property codes: 00AA → 00AB → … → 00ZZ → 01AA … → 99ZZ → 100AA.
 * Derived from a sequence number, so the numeric prefix can grow past two
 * digits without the string-sort problems of "find the max code and add one".
 */
const encodePropertyCode = (seq) => {
	const n = seq - 1;
	const prefix = Math.floor(n / LETTER_SPACE);
	return String(prefix).padStart(2, "0") + encodeLetters(n % LETTER_SPACE);
};

const decodePropertyCode = (code) => {
	const match = /^(\d{2,})([A-Z]{2})$/.exec(code || "");
	if (!match) return 0;
	return Number(match[1]) * LETTER_SPACE + decodeLetters(match[2]) + 1;
};

const encodeClientCode = (seq) => `CL-${String(seq).padStart(6, "0")}`;

const decodeClientCode = (code) => {
	const match = /^CL-(\d+)$/.exec(code || "");
	return match ? Number(match[1]) : 0;
};

/** Atomically reserves the next value of a named sequence. */
const nextSequence = async (name, { session } = {}) => {
	const counter = await Counter.findOneAndUpdate(
		{ _id: name },
		{ $inc: { seq: 1 } },
		{ upsert: true, returnDocument: "after", session },
	);
	return counter.seq;
};

const nextPropertyCode = async (options) =>
	encodePropertyCode(await nextSequence("property", options));

const nextClientCode = async (options) =>
	encodeClientCode(await nextSequence("client", options));

module.exports = {
	encodeLetters,
	decodeLetters,
	encodePropertyCode,
	decodePropertyCode,
	encodeClientCode,
	decodeClientCode,
	nextSequence,
	nextPropertyCode,
	nextClientCode,
};

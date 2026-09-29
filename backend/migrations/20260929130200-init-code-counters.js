const { decodeClientCode, decodePropertyCode } = require("../utils/codeGenerator");

/**
 * Seeds the atomic code counters from the highest existing codes so new codes
 * never collide. $max makes it safe to re-run: a counter never moves backwards.
 */
module.exports = {
	async up(db) {
		const maxOf = async (collection, field, decode) => {
			let max = 0;
			for await (const doc of db.collection(collection).find({}, { projection: { [field]: 1 } })) {
				max = Math.max(max, decode(doc[field]));
			}
			return max;
		};

		const counters = db.collection("counters");
		await counters.updateOne(
			{ _id: "client" },
			{ $max: { seq: await maxOf("clients", "clientCode", decodeClientCode) } },
			{ upsert: true },
		);
		await counters.updateOne(
			{ _id: "property" },
			{ $max: { seq: await maxOf("properties", "propertyCode", decodePropertyCode) } },
			{ upsert: true },
		);
	},

	async down() {
		// Counters are left in place: removing them would allow duplicate codes.
	},
};

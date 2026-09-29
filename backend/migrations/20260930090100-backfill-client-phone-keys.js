const { normalizeIndianMobile } = require("../utils/phone");

/**
 * Sets clients.phoneKey (canonical +91XXXXXXXXXX) and creates the unique index.
 *
 * Existing duplicates are reported, not merged: the oldest live client keeps
 * the key, later ones stay without it (so the index can be built) and are
 * listed for an admin to sort out. Numbers that can't be normalised are listed
 * too. Idempotent.
 */
module.exports = {
	async up(db) {
		const clients = db.collection("clients");
		const owner = new Map();
		const duplicates = [];
		const invalid = [];

		for await (const c of clients.find({}, { projection: { clientCode: 1, phone: 1, phoneKey: 1, deletedAt: 1, createdAt: 1 } }).sort({ createdAt: 1, _id: 1 })) {
			if (c.deletedAt) {
				if (c.phoneKey) await clients.updateOne({ _id: c._id }, { $unset: { phoneKey: "" } });
				continue;
			}
			const key = normalizeIndianMobile(c.phone);
			if (!key) {
				invalid.push(c.clientCode || String(c._id));
				continue;
			}
			if (owner.has(key)) {
				duplicates.push(`${c.clientCode || c._id} duplicates ${owner.get(key)}`);
				if (c.phoneKey) await clients.updateOne({ _id: c._id }, { $unset: { phoneKey: "" } });
				continue;
			}
			owner.set(key, c.clientCode || String(c._id));
			if (c.phoneKey !== key) await clients.updateOne({ _id: c._id }, { $set: { phoneKey: key } });
		}

		await clients.createIndex(
			{ phoneKey: 1 },
			{ unique: true, partialFilterExpression: { phoneKey: { $type: "string" } } },
		);

		console.log(`phoneKey backfill: ${owner.size} clients keyed, ${duplicates.length} duplicates, ${invalid.length} invalid numbers`);
		if (duplicates.length) console.log(`  duplicates (left without a key): ${duplicates.join("; ")}`);
		if (invalid.length) console.log(`  invalid numbers: ${invalid.join(", ")}`);
		return { keyed: owner.size, duplicates, invalid };
	},

	async down(db) {
		await db.collection("clients").dropIndex("phoneKey_1").catch(() => {});
		await db.collection("clients").updateMany({}, { $unset: { phoneKey: "" } });
	},
};

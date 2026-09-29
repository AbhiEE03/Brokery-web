const { computeHash, GENESIS_HASH, COUNTER_ID } = require("../services/auditService");

const ENTITY_TYPES = ["client", "property", "match", "change_request", "user"];

/**
 * Copies the old activity log into the hash-chained audit log as legacy entries,
 * oldest first, continuing from the current chain head.
 *
 * Run it before deploying the audit-log release, so legacy entries come first
 * and nothing else writes to the chain meanwhile. Idempotent: entries already
 * copied (matched by legacyId) are skipped. The activitylogs collection is left
 * untouched.
 */
module.exports = {
	async up(db) {
		const auditlogs = db.collection("auditlogs");
		const [head] = await auditlogs.find().sort({ seq: -1 }).limit(1).toArray();
		let seq = head?.seq || 0;
		let prevHash = head?.hash || GENESIS_HASH;

		const copied = new Set((await auditlogs.distinct("legacyId", { legacy: true })).map(String));

		for await (const log of db.collection("activitylogs").find().sort({ createdAt: 1, _id: 1 })) {
			if (copied.has(String(log._id))) continue;
			const entityType = ENTITY_TYPES.includes(log.entity) ? log.entity : "user";
			seq += 1;
			const entry = {
				seq,
				at: log.createdAt || log._id.getTimestamp(),
				actor: log.performedBy || null,
				action: `${entityType}.legacy`,
				entityType,
				entityId: log.entityId || null,
				summary: String(log.action || "activity"),
				before: null,
				after: null,
				meta: log.metadata || null,
				requestId: null,
				legacy: true,
				legacyId: log._id,
				prevHash,
			};
			entry.hash = computeHash(prevHash, entry);
			await auditlogs.insertOne(entry);
			prevHash = entry.hash;
		}

		if (seq > 0) {
			await db.collection("counters").updateOne(
				{ _id: COUNTER_ID },
				{ $set: { seq, lastHash: prevHash } },
				{ upsert: true },
			);
		}
	},

	async down(db) {
		const auditlogs = db.collection("auditlogs");
		if (await auditlogs.countDocuments({ legacy: { $ne: true } })) {
			throw new Error("New audit entries exist after the legacy ones; removing legacy entries would break the chain.");
		}
		await auditlogs.deleteMany({ legacy: true });
		await db.collection("counters").deleteOne({ _id: COUNTER_ID });
	},
};

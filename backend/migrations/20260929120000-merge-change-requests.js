/**
 * Merges clientchangerequests + propertychangerequests into the unified
 * changerequests collection. Idempotent (upsert by _id) and non-destructive:
 * the legacy collections are left in place and dropped by a later migration
 * once production has been verified.
 */
const SOURCES = [
	{ collection: "clientchangerequests", entityType: "client", entityModel: "Client", refField: "client" },
	{ collection: "propertychangerequests", entityType: "property", entityModel: "Property", refField: "property" },
];

module.exports = {
	async up(db) {
		const target = db.collection("changerequests");

		for (const source of SOURCES) {
			const cursor = db.collection(source.collection).find({});
			for await (const doc of cursor) {
				const { [source.refField]: entityId, __v, ...rest } = doc;
				const createdAt = doc.createdAt || doc._id.getTimestamp();

				await target.updateOne(
					{ _id: doc._id },
					{
						$setOnInsert: {
							...rest,
							entityType: source.entityType,
							entityModel: source.entityModel,
							entityId,
							changes: (doc.changes || []).map(({ field, oldValue, newValue }) => ({
								field,
								oldValue,
								newValue,
							})),
							createdAt,
							updatedAt: doc.resolvedAt || createdAt,
						},
					},
					{ upsert: true },
				);
			}
		}
	},

	async down(db) {
		const target = db.collection("changerequests");
		for (const source of SOURCES) {
			const ids = await db.collection(source.collection).distinct("_id");
			await target.deleteMany({ _id: { $in: ids } });
		}
	},
};

// Lowercased city copies used for case-insensitive filtering (kept in sync by
// pre-validate hooks from now on). Idempotent.
module.exports = {
	async up(db) {
		await db.collection("properties").updateMany({ "location.city": { $type: "string" } }, [
			{ $set: { "location.cityKey": { $toLower: { $trim: { input: "$location.city" } } } } },
		]);
		await db.collection("clients").updateMany({ "requirements.city": { $type: "string" } }, [
			{ $set: { "requirements.cityKey": { $toLower: { $trim: { input: "$requirements.city" } } } } },
		]);
	},

	async down(db) {
		await db.collection("properties").updateMany({}, { $unset: { "location.cityKey": "" } });
		await db.collection("clients").updateMany({}, { $unset: { "requirements.cityKey": "" } });
	},
};

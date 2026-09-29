/**
 * Clients created before StageTransition existed get one approximate history
 * row: null → current stage. The timestamp is createdAt for leads and the last
 * update otherwise; rows are flagged backfilled so time-in-stage ignores them.
 * Idempotent: clients that already have history are skipped.
 */
module.exports = {
	async up(db) {
		const clients = db.collection("clients");
		const transitions = db.collection("stagetransitions");
		const withHistory = new Set(
			(await transitions.distinct("client")).map((id) => id.toString()),
		);

		const batch = [];
		for await (const client of clients.find({}, { projection: { pipelineStage: 1, createdAt: 1, updatedAt: 1, assignedBroker: 1 } })) {
			if (withHistory.has(client._id.toString())) continue;
			const stage = client.pipelineStage || "lead";
			const created = client.createdAt || client._id.getTimestamp();
			batch.push({
				client: client._id,
				from: null,
				to: stage,
				changedBy: client.assignedBroker || null,
				via: "backfill",
				backfilled: true,
				at: stage === "lead" ? created : client.updatedAt || created,
			});
			if (batch.length === 1000) await transitions.insertMany(batch.splice(0));
		}
		if (batch.length) await transitions.insertMany(batch);
	},

	async down(db) {
		await db.collection("stagetransitions").deleteMany({ via: "backfill" });
	},
};

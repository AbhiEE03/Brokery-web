const mongoose = require("mongoose");

/**
 * Append-only pipeline history: one row every time a client's stage changes.
 * Analytics (closures per month, funnel, time in stage) read these events
 * instead of guessing from the client's current state or updatedAt.
 */
const stageTransitionSchema = new mongoose.Schema({
	client: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "Client",
		required: true,
	},
	from: { type: String, default: null },
	to: { type: String, required: true },
	changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
	via: {
		type: String,
		enum: ["create", "direct", "change_request", "backfill", "seed"],
		required: true,
	},
	// True for rows reconstructed by a migration: the timestamp is approximate.
	backfilled: { type: Boolean, default: false },
	at: { type: Date, default: Date.now, required: true },
});

stageTransitionSchema.index({ to: 1, at: 1 });
stageTransitionSchema.index({ client: 1, at: 1 });

module.exports = mongoose.model("StageTransition", stageTransitionSchema);

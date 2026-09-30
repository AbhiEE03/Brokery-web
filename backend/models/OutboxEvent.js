const mongoose = require("mongoose");

/**
 * Domain events written in the same transaction as the change they describe
 * (the transactional outbox pattern): if the change commits, the event exists;
 * if it rolls back, so does the event. A worker processes them afterwards with
 * at-least-once delivery, so every consumer must be idempotent.
 */
const outboxEventSchema = new mongoose.Schema(
	{
		type: { type: String, enum: ["PropertyChanged"], required: true },
		payload: { type: mongoose.Schema.Types.Mixed, required: true },
		status: {
			type: String,
			enum: ["queued", "processing", "done", "dead"],
			default: "queued",
		},
		attempts: { type: Number, default: 0 },
		nextAttemptAt: { type: Date, default: Date.now },
		lastError: { type: String },
		processedAt: { type: Date },
	},
	{ timestamps: true, minimize: false },
);

outboxEventSchema.index({ status: 1, nextAttemptAt: 1 });
outboxEventSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model("OutboxEvent", outboxEventSchema);

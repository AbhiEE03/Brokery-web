const mongoose = require("mongoose");

/**
 * Transactional outbox for user notifications. Rows are written in the same
 * transaction as the change that caused them; a dispatcher delivers them
 * afterwards, so a failed email never rolls back (or blocks) the approval.
 */
const notificationSchema = new mongoose.Schema(
	{
		user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		kind: {
			type: String,
			enum: ["change_request_resolved"],
			required: true,
		},
		payload: { type: mongoose.Schema.Types.Mixed, default: {} },
		channel: { type: String, enum: ["email"], default: "email" },
		status: {
			type: String,
			enum: ["queued", "sending", "sent", "failed"],
			default: "queued",
		},
		attempts: { type: Number, default: 0 },
		lastError: { type: String },
		nextAttemptAt: { type: Date, default: Date.now },
		sentAt: { type: Date },
	},
	{ timestamps: true },
);

notificationSchema.index({ status: 1, nextAttemptAt: 1 });
notificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);

const mongoose = require("mongoose");

/**
 * In-app notifications for a user (the bell in the sidebar). Separate from
 * Notification, which is the email outbox.
 *
 * `eventId` + `client` is unique when set, so processing the same event twice
 * (at-least-once delivery) can never alert a broker twice about one client.
 */
const alertSchema = new mongoose.Schema(
	{
		user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		kind: { type: String, enum: ["shortlist_feedback", "new_match"], required: true },
		title: { type: String, required: true },
		body: { type: String },
		href: { type: String }, // frontend path to open
		client: { type: mongoose.Schema.Types.ObjectId, ref: "Client" },
		property: { type: mongoose.Schema.Types.ObjectId, ref: "Property" },
		eventId: { type: mongoose.Schema.Types.ObjectId },
		score: { type: Number },
		readAt: { type: Date, default: null },
	},
	{ timestamps: true },
);

alertSchema.index({ user: 1, readAt: 1, createdAt: -1 });
alertSchema.index(
	{ eventId: 1, client: 1 },
	{ unique: true, partialFilterExpression: { eventId: { $exists: true } } },
);

module.exports = mongoose.model("Alert", alertSchema);

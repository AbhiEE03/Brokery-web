const mongoose = require("mongoose");

/**
 * A shareable, expiring link that shows a buyer a handful of properties.
 * Only the SHA-256 of the token is stored (like a password hash), so a copy of
 * the database can't be used to open anyone's link.
 */
const shortlistLinkSchema = new mongoose.Schema(
	{
		tokenHash: { type: String, required: true },
		client: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
		properties: [{ type: mongoose.Schema.Types.ObjectId, ref: "Property" }],
		createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		expiresAt: { type: Date, required: true },
		revokedAt: { type: Date, default: null },
		revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
		firstOpenedAt: { type: Date, default: null },
		lastOpenedAt: { type: Date, default: null },
		openCount: { type: Number, default: 0 },
	},
	{ timestamps: true },
);

shortlistLinkSchema.index({ tokenHash: 1 }, { unique: true });
shortlistLinkSchema.index({ client: 1, createdAt: -1 });

module.exports = mongoose.model("ShortlistLink", shortlistLinkSchema);

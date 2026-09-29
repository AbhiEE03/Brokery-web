const mongoose = require("mongoose");

/**
 * Raised when a broker tries to register a buyer (by phone) that another broker
 * already owns. The claimant never sees the existing record; an admin decides,
 * using the audit log's first entry for that client as evidence of who came first.
 */
const ownershipClaimSchema = new mongoose.Schema(
	{
		phoneKey: { type: String, required: true },
		existingClient: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
		existingBroker: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
		claimant: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		// What the claimant submitted, so the admin can compare both records.
		submitted: {
			name: { type: String, trim: true },
			email: { type: String, trim: true, lowercase: true },
			phone: { type: String, trim: true },
		},
		status: {
			type: String,
			enum: ["open", "upheld", "transferred"],
			default: "open",
		},
		evidence: {
			registeredAt: { type: Date },
			firstAuditSeq: { type: Number, default: null },
			firstAuditHash: { type: String, default: null },
		},
		resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
		resolvedAt: { type: Date },
		note: { type: String, trim: true, maxlength: 500 },
	},
	{ timestamps: true },
);

ownershipClaimSchema.index({ status: 1, createdAt: -1 });
// One open claim per broker per number: repeated attempts don't pile up.
ownershipClaimSchema.index(
	{ phoneKey: 1, claimant: 1 },
	{ unique: true, partialFilterExpression: { status: "open" } },
);

module.exports = mongoose.model("OwnershipClaim", ownershipClaimSchema);

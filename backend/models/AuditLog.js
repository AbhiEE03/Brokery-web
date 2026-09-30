const mongoose = require("mongoose");

/**
 * Append-only, hash-chained audit trail. Each entry stores the previous entry's
 * hash and its own hash = sha256(prevHash + canonicalJSON(entry)), so editing or
 * deleting any stored entry breaks the chain from that point on (see
 * services/auditService.js → verifyChain).
 */
const auditLogSchema = new mongoose.Schema(
	{
		seq: { type: Number, required: true },
		at: { type: Date, required: true },
		actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
		action: { type: String, required: true },
		entityType: {
			type: String,
			enum: ["client", "property", "match", "change_request", "user", "ownership_claim", "shortlist"],
			required: true,
		},
		entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
		// The client/property a change request or claim is about, for per-record history.
		subject: {
			type: { type: String },
			id: { type: mongoose.Schema.Types.ObjectId },
		},
		summary: { type: String, required: true },
		before: { type: mongoose.Schema.Types.Mixed, default: null },
		after: { type: mongoose.Schema.Types.Mixed, default: null },
		meta: { type: mongoose.Schema.Types.Mixed, default: null },
		requestId: { type: String, default: null },
		legacy: { type: Boolean, default: false },
		legacyId: { type: mongoose.Schema.Types.ObjectId },
		prevHash: { type: String, required: true },
		hash: { type: String, required: true },
	},
	{ versionKey: false, minimize: false },
);

auditLogSchema.index({ seq: 1 }, { unique: true });
auditLogSchema.index({ actor: 1, seq: -1 });
auditLogSchema.index({ entityType: 1, seq: -1 });
auditLogSchema.index({ entityId: 1, seq: -1 });
auditLogSchema.index({ "subject.id": 1, seq: -1 });
auditLogSchema.index({ at: -1 });
auditLogSchema.index({ legacyId: 1 }, { unique: true, partialFilterExpression: { legacyId: { $exists: true } } });

module.exports = mongoose.model("AuditLog", auditLogSchema);

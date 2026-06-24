const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema({
	performedBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
		required: true,
	},
	action: {
		type: String,
		required: true,
	},
	entity: {
		type: String,
		enum: ["client", "property", "match", "change_request", "user"],
	},
	entityId: {
		type: mongoose.Schema.Types.ObjectId,
	},
	metadata: {
		type: mongoose.Schema.Types.Mixed,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ performedBy: 1, createdAt: -1 });

module.exports = mongoose.model("ActivityLog", activityLogSchema);

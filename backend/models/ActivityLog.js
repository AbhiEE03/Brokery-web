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
}, { timestamps: { createdAt: true, updatedAt: false } });

activityLogSchema.index({ createdAt: -1, _id: -1 });
activityLogSchema.index({ entity: 1, createdAt: -1 });
activityLogSchema.index({ performedBy: 1, createdAt: -1 });

module.exports = mongoose.model("ActivityLog", activityLogSchema);

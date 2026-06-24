const mongoose = require("mongoose");

const clientChangeRequestSchema = new mongoose.Schema({
	client: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "Client",
		required: true,
	},
	requestedBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
		required: true,
	},
	status: {
		type: String,
		enum: ["pending", "approved", "rejected"],
		default: "pending",
	},
	changes: [
		{
			field: {
				type: String,
				required: true,
			},
			oldValue: {
				type: mongoose.Schema.Types.Mixed,
			},
			newValue: {
				type: mongoose.Schema.Types.Mixed,
			},
		},
	],
	adminNote: {
		type: String,
		trim: true,
	},
	resolvedBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
	},
	resolvedAt: {
		type: Date,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

module.exports = mongoose.model(
	"ClientChangeRequest",
	clientChangeRequestSchema,
);

const mongoose = require("mongoose");

const matchSchema = new mongoose.Schema({
	client: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "Client",
		required: true,
	},
	property: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "Property",
		required: true,
	},
	interestLevel: {
		type: String,
		enum: ["high", "medium", "low"],
		required: true,
	},
	notes: {
		type: String,
		trim: true,
	},
	createdBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
});

matchSchema.index({ client: 1, property: 1 }, { unique: true });

module.exports = mongoose.model("Match", matchSchema);

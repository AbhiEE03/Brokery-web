const mongoose = require("mongoose");

/**
 * What brokers did with a recommendation: linked it (created a match) or
 * dismissed it ("not a fit", hidden from future recommendations). This is
 * the implicit feedback that matching quality can later be measured against.
 */
const recommendationEventSchema = new mongoose.Schema(
	{
		client: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
		property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },
		broker: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
		action: { type: String, enum: ["linked", "dismissed"], required: true },
		rank: { type: Number },
		score: { type: Number },
	},
	{ timestamps: { createdAt: true, updatedAt: false } },
);

recommendationEventSchema.index({ client: 1, action: 1 });
recommendationEventSchema.index({ client: 1, property: 1, action: 1 }, { unique: true });

module.exports = mongoose.model("RecommendationEvent", recommendationEventSchema);

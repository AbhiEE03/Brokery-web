const mongoose = require("mongoose");

// A buyer's reaction to one property on one shortlist link: one row per
// (link, property), so repeated taps update it instead of piling up.
const shortlistFeedbackSchema = new mongoose.Schema(
	{
		link: { type: mongoose.Schema.Types.ObjectId, ref: "ShortlistLink", required: true },
		client: { type: mongoose.Schema.Types.ObjectId, ref: "Client", required: true },
		property: { type: mongoose.Schema.Types.ObjectId, ref: "Property", required: true },
		reaction: { type: String, enum: ["like", "dislike", "visit"], required: true },
		comment: { type: String, trim: true, maxlength: 500 },
	},
	{ timestamps: true },
);

shortlistFeedbackSchema.index({ link: 1, property: 1 }, { unique: true });
shortlistFeedbackSchema.index({ client: 1, updatedAt: -1 });

module.exports = mongoose.model("ShortlistFeedback", shortlistFeedbackSchema);

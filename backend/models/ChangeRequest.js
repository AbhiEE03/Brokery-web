const mongoose = require("mongoose");

// Maps entityType → Mongoose model name, used for populate via refPath.
const ENTITY_MODELS = { client: "Client", property: "Property" };

const STATUSES = ["pending", "approved", "rejected", "conflict", "superseded", "withdrawn"];

const changeRequestSchema = new mongoose.Schema(
	{
		entityType: {
			type: String,
			enum: Object.keys(ENTITY_MODELS),
			required: true,
		},
		entityModel: {
			type: String,
			enum: Object.values(ENTITY_MODELS),
			required: true,
		},
		entityId: {
			type: mongoose.Schema.Types.ObjectId,
			refPath: "entityModel",
			required: true,
		},
		requestedBy: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "User",
			required: true,
		},
		status: {
			type: String,
			enum: STATUSES,
			default: "pending",
		},
		changes: [
			{
				_id: false,
				field: { type: String, required: true },
				oldValue: { type: mongoose.Schema.Types.Mixed },
				newValue: { type: mongoose.Schema.Types.Mixed },
			},
		],
		// Fields whose current value no longer matched oldValue at approval time.
		conflictFields: [String],
		adminNote: { type: String, trim: true },
		resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
		resolvedAt: { type: Date },
	},
	{ timestamps: true },
);

changeRequestSchema.pre("validate", function () {
	this.entityModel = ENTITY_MODELS[this.entityType];
});

changeRequestSchema.index({ status: 1, createdAt: -1 });
changeRequestSchema.index({ entityType: 1, entityId: 1, status: 1 });
changeRequestSchema.index({ requestedBy: 1, createdAt: -1 });

module.exports = mongoose.model("ChangeRequest", changeRequestSchema);
module.exports.ENTITY_MODELS = ENTITY_MODELS;
module.exports.STATUSES = STATUSES;

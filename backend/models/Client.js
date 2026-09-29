const mongoose = require("mongoose");

const clientSchema = new mongoose.Schema({
	clientCode: {
		type: String,
		unique: true,
	},
	name: {
		type: String,
		required: true,
		trim: true,
	},
	phone: {
		type: String,
		required: true,
		trim: true,
	},
	email: {
		type: String,
		trim: true,
		lowercase: true,
	},
	assignedBroker: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
	},
	pipelineStage: {
		type: String,
		enum: ["lead", "contacted", "site_visit", "negotiation", "closed", "lost"],
		default: "lead",
	},
	requirements: {
		propertyType: {
			type: String,
			enum: ["flat", "villa", "plot", "commercial"],
		},
		city: {
			type: String,
			trim: true,
		},
		locality: {
			type: String,
			trim: true,
		},
		minBudget: {
			type: Number,
		},
		maxBudget: {
			type: Number,
		},
		minArea: {
			type: Number,
		},
		maxArea: {
			type: Number,
		},
		bedrooms: {
			type: Number,
		},
	},
	documents: [
		{
			name: {
				type: String,
				trim: true,
			},
			url: {
				type: String,
			},
			type: {
				type: String,
				enum: ["id_proof", "income_proof", "agreement", "other"],
			},
			uploadedAt: {
				type: Date,
				default: Date.now,
			},
		},
	],
	notes: {
		type: String,
		trim: true,
	},
	// Incremented by the approval engine on every change; concurrent writers to
	// the same record conflict on it, which serializes their transactions.
	revision: {
		type: Number,
		default: 0,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
	updatedAt: {
		type: Date,
		default: Date.now,
	},
});

clientSchema.pre("save", function () {
	this.updatedAt = Date.now();
});

// Range checks run on the merged document, so a partial edit can't produce min > max.
clientSchema.pre("validate", function () {
	const r = this.requirements || {};
	const isSet = (v) => typeof v === "number";
	if (isSet(r.minBudget) && isSet(r.maxBudget) && r.minBudget > r.maxBudget) {
		this.invalidate("requirements.minBudget", "minBudget must not exceed maxBudget");
	}
	if (isSet(r.minArea) && isSet(r.maxArea) && r.minArea > r.maxArea) {
		this.invalidate("requirements.minArea", "minArea must not exceed maxArea");
	}
});

module.exports = mongoose.model("Client", clientSchema);

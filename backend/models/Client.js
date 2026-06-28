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

module.exports = mongoose.model("Client", clientSchema);

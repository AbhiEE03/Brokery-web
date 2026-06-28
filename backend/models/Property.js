const mongoose = require("mongoose");

const propertySchema = new mongoose.Schema({
	propertyCode: {
		type: String,
		unique: true,
	},
	title: {
		type: String,
		required: true,
		trim: true,
	},
	propertyType: {
		type: String,
		enum: ["flat", "villa", "plot", "commercial"],
	},
	status: {
		type: String,
		enum: ["available", "under_negotiation", "sold", "withdrawn"],
		default: "available",
	},
	location: {
		city: {
			type: String,
			required: true,
			trim: true,
		},
		locality: {
			type: String,
			trim: true,
		},
		sector: {
			type: String,
			trim: true,
		},
		pincode: {
			type: String,
			trim: true,
		},
	},
	pricing: {
		askingPrice: {
			type: Number,
		},
		pricePerSqft: {
			type: Number,
		},
	},
	specs: {
		area: {
			type: Number,
		},
		bedrooms: {
			type: Number,
		},
		bathrooms: {
			type: Number,
		},
		floor: {
			type: Number,
		},
		totalFloors: {
			type: Number,
		},
		parking: {
			type: Boolean,
		},
		furnished: {
			type: String,
			enum: ["unfurnished", "semi-furnished", "fully-furnished"],
		},
	},
	dealer: {
		name: {
			type: String,
			trim: true,
		},
		phone: {
			type: String,
			trim: true,
		},
		email: {
			type: String,
			trim: true,
			lowercase: true,
		},
	},
	images: [String],
	documents: [String],
	addedBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
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

propertySchema.pre("save", function () {
	this.updatedAt = Date.now();
});

module.exports = mongoose.model("Property", propertySchema);

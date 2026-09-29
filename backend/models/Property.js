const mongoose = require("mongoose");
const softDelete = require("./plugins/softDelete");

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
		// Lowercased city for case-insensitive filtering; maintained on validate.
		cityKey: {
			type: String,
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
	images: [
		{
			url: {
				type: String,
			},
			uploadedAt: {
				type: Date,
				default: Date.now,
			},
		},
	],
	addedBy: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "User",
	},
	// Incremented by the approval engine on every change; concurrent writers to
	// the same record conflict on it, which serializes their transactions.
	revision: {
		type: Number,
		default: 0,
	},
}, { timestamps: true });

propertySchema.plugin(softDelete);

propertySchema.pre("validate", function () {
	if (this.location) {
		this.location.cityKey = this.location.city?.trim().toLowerCase() || undefined;
	}
});

// Inventory filters (status + city is the common combination) and default sort.
propertySchema.index({ status: 1, "location.cityKey": 1, createdAt: -1 });
propertySchema.index({ "pricing.askingPrice": 1 });
propertySchema.index({ addedBy: 1, createdAt: -1 });
propertySchema.index({ createdAt: -1 });
// Free-text search. Title matches rank above locality matches.
propertySchema.index(
	{ title: "text", "location.locality": "text" },
	{ name: "property_text", weights: { title: 3, "location.locality": 1 } },
);

module.exports = mongoose.model("Property", propertySchema);

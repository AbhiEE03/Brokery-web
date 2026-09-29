const mongoose = require("mongoose");

// Named monotonically increasing sequences (client codes, property codes).
const counterSchema = new mongoose.Schema(
	{
		_id: { type: String },
		seq: { type: Number, default: 0 },
	},
	{ versionKey: false },
);

module.exports = mongoose.model("Counter", counterSchema);

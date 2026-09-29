const mongoose = require("mongoose");

// Named monotonically increasing sequences (client codes, property codes, audit log).
// The audit sequence also keeps the hash of the latest entry (chain head).
const counterSchema = new mongoose.Schema(
	{
		_id: { type: String },
		seq: { type: Number, default: 0 },
		lastHash: { type: String },
	},
	{ versionKey: false },
);

module.exports = mongoose.model("Counter", counterSchema);

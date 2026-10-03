const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
	name: {
		type: String,
		required: true,
		trim: true,
	},
	email: {
		type: String,
		required: true,
		unique: true,
		trim: true,
		lowercase: true,
	},
	password: {
		type: String,
		required: true,
	},
	role: {
		type: String,
		enum: ["admin", "broker"],
		default: "broker",
	},
	isActive: {
		type: Boolean,
		default: true,
	},
	// Included in every JWT as `tv`. Bumping it (on a password reset) makes all
	// tokens issued before that moment invalid: server-side revocation for
	// otherwise stateless tokens. Missing on old documents/tokens means 0.
	tokenVersion: {
		type: Number,
		default: 0,
	},
}, { timestamps: true });

userSchema.pre("save", async function () {
	if (!this.isModified("password")) return;

	const salt = await bcrypt.genSalt(10);
	this.password = await bcrypt.hash(this.password, salt);
});

module.exports = mongoose.model("User", userSchema);

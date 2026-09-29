require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

// Usage: ADMIN_EMAIL=admin@brokery.com ADMIN_PASSWORD='<strong password>' npm run create-admin
const createAdmin = async () => {
	const email = (process.env.ADMIN_EMAIL || "admin@brokery.com").toLowerCase();
	const password = process.env.ADMIN_PASSWORD;

	if (!password || password.length < 10) {
		console.error("ADMIN_PASSWORD must be set and at least 10 characters long.");
		process.exit(1);
	}

	try {
		await mongoose.connect(process.env.MONGO_URI);

		const hashedPassword = await bcrypt.hash(password, 10);

		await User.findOneAndUpdate(
			{ email },
			{
				$set: {
					name: "Admin",
					email,
					password: hashedPassword,
					role: "admin",
					isActive: true,
				},
			},
			{ upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
		);

		console.log(`Admin ready: ${email}`);
	} catch (error) {
		console.error("Admin creation failed:", error.message);
		process.exitCode = 1;
	} finally {
		await mongoose.disconnect();
	}
};

createAdmin();

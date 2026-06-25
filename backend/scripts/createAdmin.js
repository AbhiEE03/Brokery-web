require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");

const createAdmin = async () => {
	try {
		await mongoose.connect(process.env.MONGO_URI);

		const hashedPassword = await bcrypt.hash("Admin@abhi", 10);

		await User.findOneAndUpdate(
			{ email: "admin@brokery.com" },
			{
				$set: {
					name: "Admin",
					email: "admin@brokery.com",
					password: hashedPassword,
					role: "admin",
					isActive: true,
				},
			},
			{ upsert: true, new: true, setDefaultsOnInsert: true },
		);

		console.log("Admin ready");
	} catch (error) {
		console.error("Admin creation failed:", error.message);
	} finally {
		await mongoose.disconnect();
	}
};

createAdmin();

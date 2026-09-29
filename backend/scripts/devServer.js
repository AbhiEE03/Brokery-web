/**
 * Local sandbox: in-memory MongoDB replica set + demo seed + API.
 * Never touches the database in .env. Data is discarded on exit.
 *
 *   npm run dev:sandbox
 */
const crypto = require("crypto");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

const LOCAL_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@Sandbox1";

const start = async () => {
	process.env.PORT = process.env.PORT || "5000";
	process.env.JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
	process.env.CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";
	process.env.UPLOAD_DRIVER = "local";
	delete process.env.EMAIL_USER;
	delete process.env.EMAIL_PASS;

	const replSet = await MongoMemoryReplSet.create({
		replSet: { count: 1, storageEngine: "wiredTiger" },
	});
	process.env.MONGO_URI = replSet.getUri("brokery");
	await mongoose.connect(process.env.MONGO_URI);

	const { seedDatabase } = require("./seed");
	await seedDatabase({ adminPassword: LOCAL_ADMIN_PASSWORD });

	const createApp = require("../app");
	const server = createApp().listen(process.env.PORT, () => {
		console.log(`\nSandbox API on http://localhost:${process.env.PORT}/api`);
		console.log(`Admin login (sandbox only): admin@brokery.com / ${LOCAL_ADMIN_PASSWORD}`);
		console.log("Broker logins: see README demo credentials\n");
	});

	const shutdown = async () => {
		server.close();
		await mongoose.disconnect();
		await replSet.stop();
		process.exit(0);
	};
	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
};

start().catch((error) => {
	console.error(error);
	process.exit(1);
});

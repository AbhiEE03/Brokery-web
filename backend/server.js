require("dotenv").config();
const { loadEnv } = require("./config/env");

let env;
try {
	({ env } = loadEnv());
} catch (error) {
	console.error(error.message);
	process.exit(1);
}

const mongoose = require("mongoose");
const logger = require("./config/logger");
const connectDB = require("./config/db");
const createApp = require("./app");
const { createOutboxWorker } = require("./workers/outboxWorker");

const SHUTDOWN_TIMEOUT_MS = 10000;

const startServer = async () => {
	for (const warning of loadEnv().warnings) logger.warn(warning);

	await connectDB();
	const worker = createOutboxWorker().start();
	const server = createApp().listen(env.PORT, () => {
		logger.info({ port: env.PORT }, "Server started");
	});

	// Graceful shutdown: stop accepting connections, let in-flight requests and
	// the current outbox run finish, then close the database connection.
	let shuttingDown = false;
	const shutdown = (signal) => {
		if (shuttingDown) return;
		shuttingDown = true;
		logger.info({ signal }, "Shutting down");

		const force = setTimeout(() => {
			logger.error("Forced shutdown after timeout");
			process.exit(1);
		}, SHUTDOWN_TIMEOUT_MS);
		force.unref();

		server.close(async () => {
			await worker.stop();
			await mongoose.disconnect();
			process.exit(0);
		});
	};

	process.on("SIGTERM", () => shutdown("SIGTERM"));
	process.on("SIGINT", () => shutdown("SIGINT"));
};

startServer().catch((error) => {
	logger.fatal({ err: error }, "Failed to start");
	process.exit(1);
});

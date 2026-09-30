const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const mongoose = require("mongoose");
const path = require("path");
const pinoHttp = require("pino-http");
const logger = require("./config/logger");
const { requestContext } = require("./utils/requestContext");
const authRoutes = require("./routes/authRoutes");
const propertyRoutes = require("./routes/propertyRoutes");
const clientRoutes = require("./routes/clientRoutes");
const changeRequestRoutes = require("./routes/changeRequestRoutes");
const matchRoutes = require("./routes/matchRoutes");
const activityRoutes = require("./routes/activityRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const ownershipRoutes = require("./routes/ownershipRoutes");
const metaRoutes = require("./routes/metaRoutes");
const { shortlistRouter, publicRouter } = require("./routes/shortlistRoutes");
const { createApiLimiter } = require("./middleware/rateLimit");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

const REQUEST_ID = /^[\w-]{1,64}$/;

const createApp = () => {
	const app = express();

	// Behind Render/Vercel proxies the client IP is in X-Forwarded-For; rate
	// limiting needs the real IP. Set TRUST_PROXY=1 when deployed behind one proxy.
	if (process.env.TRUST_PROXY) {
		const value = Number(process.env.TRUST_PROXY);
		app.set("trust proxy", Number.isNaN(value) ? process.env.TRUST_PROXY : value);
	}

	app.use(
		pinoHttp({
			logger,
			genReqId: (req, res) => {
				const incoming = req.headers["x-request-id"];
				const id = typeof incoming === "string" && REQUEST_ID.test(incoming) ? incoming : crypto.randomUUID();
				res.setHeader("X-Request-Id", id);
				return id;
			},
			autoLogging: { ignore: (req) => req.url === "/healthz" },
			customLogLevel: (req, res, error) =>
				error || res.statusCode >= 500 ? "error"
				: res.statusCode >= 400 ? "warn"
				: "info",
		}),
	);

	app.use(requestContext);
	app.use(helmet());
	app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
	app.use(express.json({ limit: "100kb" }));

	// Local-only upload storage (see utils/storage.js); never enabled in production.
	if (process.env.UPLOAD_DRIVER === "local") {
		app.use(
			"/dev-uploads",
			helmet.crossOriginResourcePolicy({ policy: "cross-origin" }),
			express.static(path.join(__dirname, ".dev-uploads")),
		);
	}

	app.get("/", (req, res) => {
		res.json({ success: true, message: "Brokery CRM backend is running" });
	});

	// Liveness: the process is up.
	app.get("/healthz", (req, res) => {
		res.json({ status: "ok" });
	});

	// Readiness: the database answers.
	app.get("/readyz", async (req, res) => {
		try {
			if (mongoose.connection.readyState !== 1) throw new Error("not connected");
			await mongoose.connection.db.admin().ping();
			res.json({ status: "ready" });
		} catch (error) {
			res.status(503).json({ status: "unavailable", reason: error.message });
		}
	});

	app.use("/api", createApiLimiter());
	app.use("/api/auth", authRoutes);
	// Upload endpoints are nested under client and property routes.
	app.use("/api/properties", propertyRoutes);
	app.use("/api/clients", clientRoutes);
	app.use("/api/change-requests", changeRequestRoutes);
	app.use("/api/matches", matchRoutes);
	app.use("/api/activity", activityRoutes);
	app.use("/api/analytics", analyticsRoutes);
	app.use("/api/ownership-claims", ownershipRoutes);
	app.use("/api/meta", metaRoutes);
	app.use("/api/shortlists", shortlistRouter);
	app.use("/api/public", publicRouter);

	app.use(notFoundHandler);
	app.use(errorHandler);

	return app;
};

module.exports = createApp;

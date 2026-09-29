const express = require("express");
const cors = require("cors");
const path = require("path");
const authRoutes = require("./routes/authRoutes");
const propertyRoutes = require("./routes/propertyRoutes");
const clientRoutes = require("./routes/clientRoutes");
const changeRequestRoutes = require("./routes/changeRequestRoutes");
const matchRoutes = require("./routes/matchRoutes");
const activityRoutes = require("./routes/activityRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");

const createApp = () => {
	const app = express();

	app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
	app.use(express.json());

	// Local-only upload storage (see utils/storage.js); never enabled in production.
	if (process.env.UPLOAD_DRIVER === "local") {
		app.use("/dev-uploads", express.static(path.join(__dirname, ".dev-uploads")));
	}

	app.get("/", (req, res) => {
		res.json({ message: "Brokery CRM backend is running" });
	});

	app.use("/api/auth", authRoutes);
	// Upload endpoints are nested under client and property routes.
	app.use("/api/properties", propertyRoutes);
	app.use("/api/clients", clientRoutes);
	app.use("/api/change-requests", changeRequestRoutes);
	app.use("/api/matches", matchRoutes);
	app.use("/api/activity", activityRoutes);
	app.use("/api/analytics", analyticsRoutes);

	return app;
};

module.exports = createApp;

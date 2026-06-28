require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const propertyRoutes = require("./routes/propertyRoutes");
const clientRoutes = require("./routes/clientRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Health check route
app.get("/", (req, res) => {
	res.json({ message: "Brokery CRM backend is running" });
});

// Auth routes
app.use("/api/auth", authRoutes);

// Property routes
app.use("/api/properties", propertyRoutes);

// Client routes
app.use("/api/clients", clientRoutes);

const startServer = async () => {
	await connectDB();
	app.listen(PORT, () => {
		console.log(`Server started on port ${PORT}`);
	});
};

startServer();

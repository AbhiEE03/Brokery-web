require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");

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

const startServer = async () => {
	await connectDB();
	app.listen(PORT, () => {
		console.log(`Server started on port ${PORT}`);
	});
};

startServer();

require("dotenv").config();
const connectDB = require("./config/db");
const createApp = require("./app");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
	await connectDB();
	createApp().listen(PORT, () => {
		console.log(`Server started on port ${PORT}`);
	});
};

startServer();

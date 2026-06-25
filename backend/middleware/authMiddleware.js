const jwt = require("jsonwebtoken");
const User = require("../models/User");

const verifyToken = async (req, res, next) => {
	const authHeader = req.headers.authorization;
	const token = authHeader?.split(" ")[1];

	if (!token) {
		return res.status(401).json({ message: "No token provided" });
	}

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		const user = await User.findById(decoded.id).select("-password").lean();

		if (!user) {
			return res.status(401).json({ message: "User not found" });
		}

		req.user = user;
		next();
	} catch (error) {
		return res.status(401).json({ message: "Invalid or expired token" });
	}
};

const requireAdmin = (req, res, next) => {
	if (req.user?.role !== "admin") {
		return res.status(403).json({ message: "Admin access required" });
	}

	next();
};

const requireBroker = (req, res, next) => {
	if (!["admin", "broker"].includes(req.user?.role)) {
		return res.status(403).json({ message: "Broker access required" });
	}

	next();
};

module.exports = { verifyToken, requireAdmin, requireBroker };

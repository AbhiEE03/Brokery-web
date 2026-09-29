const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { HttpError } = require("../utils/httpError");

const verifyToken = async (req, res, next) => {
	const authHeader = req.headers.authorization;
	const token = authHeader?.split(" ")[1];

	if (!token) {
		return next(new HttpError(401, "Authentication required", { code: "UNAUTHENTICATED" }));
	}

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		const user = await User.findById(decoded.id).select("-password").lean();

		if (!user || !user.isActive) {
			return next(new HttpError(401, "User not found or disabled", { code: "UNAUTHENTICATED" }));
		}

		req.user = user;
		next();
	} catch {
		return next(new HttpError(401, "Invalid or expired token", { code: "INVALID_TOKEN" }));
	}
};

const requireAdmin = (req, res, next) => {
	if (req.user?.role !== "admin") {
		return next(new HttpError(403, "Admin access required", { code: "FORBIDDEN" }));
	}

	next();
};

module.exports = { verifyToken, requireAdmin };

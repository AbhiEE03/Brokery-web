const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const limitedResponse = (message) => (req, res) =>
	res.status(429).json({
		success: false,
		code: "RATE_LIMITED",
		message,
		requestId: req.id,
	});

// Broad protection for the whole API, per client IP.
const createApiLimiter = () =>
	rateLimit({
		windowMs: 60 * 1000,
		limit: Number(process.env.RATE_LIMIT_PER_MINUTE) || 300,
		standardHeaders: "draft-8",
		legacyHeaders: false,
		handler: limitedResponse("Too many requests, please slow down."),
	});

// Brute-force protection: per IP *and* account, so one attacker can't lock
// everyone out and one account can't be hammered from a single IP.
const createLoginLimiter = () =>
	rateLimit({
		windowMs: 60 * 1000,
		limit: Number(process.env.LOGIN_RATE_LIMIT_PER_MINUTE) || 5,
		standardHeaders: "draft-8",
		legacyHeaders: false,
		skipSuccessfulRequests: true,
		keyGenerator: (req) =>
			`${ipKeyGenerator(req.ip)}:${String(req.body?.email || "").toLowerCase()}`,
		handler: limitedResponse("Too many login attempts. Try again in a minute."),
	});

module.exports = { createApiLimiter, createLoginLimiter };

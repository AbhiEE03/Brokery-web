const pino = require("pino");

const level =
	process.env.LOG_LEVEL || (process.env.NODE_ENV === "test" ? "silent" : "info");

// Structured JSON logs. Credentials never reach the log output.
const logger = pino({
	level,
	redact: {
		paths: [
			"req.headers.authorization",
			"req.headers.cookie",
			'res.headers["set-cookie"]',
		],
		censor: "[redacted]",
	},
});

module.exports = logger;

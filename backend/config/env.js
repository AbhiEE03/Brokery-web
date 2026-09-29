const { z } = require("zod");

/**
 * Validates environment variables once at boot so misconfiguration fails fast
 * with a clear message instead of surfacing as a runtime error later.
 */
const schema = z.object({
	NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
	PORT: z.coerce.number().int().positive().default(5000),
	MONGO_URI: z.string().min(1, "MONGO_URI is required"),
	JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
	JWT_EXPIRES_IN: z.string().default("7d"),
	CLIENT_URL: z.string().url("CLIENT_URL must be the frontend origin, e.g. https://app.example.com"),
	TRUST_PROXY: z.string().optional(),
	LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).optional(),
	RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),
	LOGIN_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(5),
	CLOUDINARY_CLOUD_NAME: z.string().optional(),
	CLOUDINARY_API_KEY: z.string().optional(),
	CLOUDINARY_API_SECRET: z.string().optional(),
	UPLOAD_DRIVER: z.enum(["cloudinary", "local"]).default("cloudinary"),
	EMAIL_USER: z.string().optional(),
	EMAIL_PASS: z.string().optional(),
});

const loadEnv = (source = process.env) => {
	// Backwards compatibility: some deployments named the Gmail app password EMAIL_APP_PASSWORD.
	if (!source.EMAIL_PASS && source.EMAIL_APP_PASSWORD) {
		source.EMAIL_PASS = source.EMAIL_APP_PASSWORD;
	}

	const result = schema.safeParse(source);
	if (!result.success) {
		const problems = result.error.issues
			.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
			.join("\n");
		throw new Error(`Invalid environment configuration:\n${problems}`);
	}

	const env = result.data;
	const warnings = [];
	if (env.JWT_SECRET.length < 32) {
		warnings.push("JWT_SECRET is shorter than 32 characters; use a long random value.");
	}
	if (env.UPLOAD_DRIVER === "cloudinary" && !env.CLOUDINARY_CLOUD_NAME) {
		warnings.push("Cloudinary is not configured; uploads will fail.");
	}
	if (!env.EMAIL_USER || !env.EMAIL_PASS) {
		warnings.push("EMAIL_USER/EMAIL_PASS not set; notification emails will be logged, not sent.");
	}

	return { env, warnings };
};

module.exports = { loadEnv };

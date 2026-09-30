const crypto = require("crypto");
const mongoose = require("mongoose");

process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret";
process.env.JWT_EXPIRES_IN = "1h";
process.env.RATE_LIMIT_PER_MINUTE = "100000";
process.env.PUBLIC_RATE_LIMIT_PER_MINUTE = "100000";
process.env.PUBLIC_LINK_RATE_LIMIT_PER_MINUTE = "100000";

jest.mock("../utils/storage", () => ({
	storeFile: jest.fn(async (buffer, { folder, extension }) => ({
		url: `https://files.test/${folder}/file.${extension}`,
		publicId: `${folder}/file`,
	})),
}));

jest.mock("../utils/emailService", () => ({
	sendChangeRequestResolved: jest.fn(async () => {}),
}));

// Register every model so indexes exist before tests run.
require("../models/User");
require("../models/Client");
require("../models/Property");
require("../models/Match");
require("../models/ChangeRequest");
require("../models/Notification");
require("../models/StageTransition");
require("../models/Counter");
require("../models/ActivityLog");
require("../models/AuditLog");
require("../models/OwnershipClaim");
require("../models/RecommendationEvent");
require("../models/ShortlistLink");
require("../models/ShortlistFeedback");
require("../models/Alert");
require("../models/OutboxEvent");

beforeAll(async () => {
	await mongoose.connect(process.env.MONGO_URL_TEST, {
		dbName: `test_${crypto.randomUUID()}`,
	});
	await mongoose.connection.syncIndexes();
});

afterEach(async () => {
	const collections = await mongoose.connection.db.collections();
	await Promise.all(collections.map((collection) => collection.deleteMany({})));
	jest.clearAllMocks();
});

afterAll(async () => {
	await mongoose.connection.dropDatabase();
	await mongoose.disconnect();
});

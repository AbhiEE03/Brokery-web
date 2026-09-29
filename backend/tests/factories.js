const jwt = require("jsonwebtoken");
const request = require("supertest");
const createApp = require("../app");
const User = require("../models/User");
const Client = require("../models/Client");
const Property = require("../models/Property");
const Match = require("../models/Match");

const app = createApp();
let counter = 0;
const nextId = () => {
	counter += 1;
	return counter;
};

const makeUser = async ({ role = "broker", ...overrides } = {}) => {
	const n = nextId();
	return User.create({
		name: `${role} ${n}`,
		email: `${role}${n}@test.com`,
		password: "Password@123",
		role,
		...overrides,
	});
};

const makeClient = async ({ broker, ...overrides } = {}) => {
	const n = nextId();
	return Client.create({
		clientCode: `CL-${String(n).padStart(6, "0")}`,
		name: `Client ${n}`,
		phone: `98765${String(n).padStart(5, "0")}`,
		email: `client${n}@test.com`,
		assignedBroker: broker?._id,
		requirements: {
			propertyType: "flat",
			city: "Delhi",
			locality: "Dwarka",
			minBudget: 8000000,
			maxBudget: 9000000,
			minArea: 1000,
			maxArea: 1500,
			bedrooms: 3,
		},
		...overrides,
	});
};

const makeProperty = async ({ addedBy, ...overrides } = {}) => {
	const n = nextId();
	return Property.create({
		propertyCode: `P${String(n).padStart(4, "0")}`,
		title: `Property ${n}`,
		propertyType: "flat",
		location: { city: "Delhi", locality: "Dwarka" },
		pricing: { askingPrice: 8500000 },
		specs: { area: 1200, bedrooms: 3 },
		addedBy: addedBy?._id,
		...overrides,
	});
};

const makeMatch = async ({ client, property, createdBy, ...overrides }) =>
	Match.create({
		client: client._id,
		property: property._id,
		interestLevel: "high",
		createdBy: createdBy?._id,
		...overrides,
	});

const tokenFor = (user) =>
	jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
		expiresIn: "1h",
	});

const authHeader = (user) => (user ? { Authorization: `Bearer ${tokenFor(user)}` } : {});

// Minimal valid file bodies for upload tests.
const FILES = {
	pdf: Buffer.from("%PDF-1.4\n%test\n"),
	png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]),
	fakePng: Buffer.from("not really a png"),
};

module.exports = {
	app,
	request: () => request(app),
	makeUser,
	makeClient,
	makeProperty,
	makeMatch,
	authHeader,
	tokenFor,
	FILES,
};

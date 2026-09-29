/**
 * Synthetic dataset for load testing (never for demos or production).
 * Writes straight to the collections in batches for speed; documents match
 * the Mongoose schemas, including derived fields (cityKey, codes, history).
 *
 * Usage from code: await generateSynthetic({ db, clients: 100000, ... })
 */
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { faker } = require("@faker-js/faker/locale/en_IN");
const { encodeClientCode, encodePropertyCode } = require("../utils/codeGenerator");

const CITIES = ["Delhi", "Mumbai", "Bangalore", "Hyderabad", "Pune", "Chennai", "Kolkata", "Ahmedabad"];
const TYPES = ["flat", "villa", "plot", "commercial"];
const FORWARD = ["lead", "contacted", "site_visit", "negotiation", "closed"];
const PROPERTY_STATUS = ["available", "available", "available", "under_negotiation", "sold", "withdrawn"];
const DAY_MS = 24 * 60 * 60 * 1000;
const BATCH = 5000;

const insertInBatches = async (collection, docs) => {
	for (let i = 0; i < docs.length; i += BATCH) {
		await collection.insertMany(docs.slice(i, i + BATCH), { ordered: false });
	}
};

// Weighted stage outcome: most clients are early in the pipeline.
const pickPath = () => {
	const r = faker.number.float();
	if (r < 0.1) return ["lead", "contacted", "lost"];
	const furthest = r < 0.35 ? 0 : r < 0.55 ? 1 : r < 0.7 ? 2 : r < 0.82 ? 3 : 4;
	return FORWARD.slice(0, furthest + 1);
};

const generateSynthetic = async ({
	db = mongoose.connection.db,
	brokers: brokerCount = 20,
	clients: clientCount = 100000,
	properties: propertyCount = 30000,
	matches: matchCount = 50000,
	activity: activityCount = 100000,
	pendingRequests: requestCount = 5000,
	seed = 42,
	password = "Bench@12345",
} = {}) => {
	faker.seed(seed);
	const now = Date.now();
	const hash = await bcrypt.hash(password, 10);
	const oid = () => new mongoose.Types.ObjectId();

	const admin = { _id: oid(), name: "Bench Admin", email: "admin@bench.test", password: hash, role: "admin", isActive: true, createdAt: new Date(), updatedAt: new Date() };
	const brokers = Array.from({ length: brokerCount }, (_, i) => ({
		_id: oid(),
		name: faker.person.fullName(),
		email: `broker${i}@bench.test`,
		password: hash,
		role: "broker",
		isActive: true,
		createdAt: new Date(),
		updatedAt: new Date(),
	}));
	await db.collection("users").insertMany([admin, ...brokers]);

	const properties = Array.from({ length: propertyCount }, (_, i) => {
		const city = faker.helpers.arrayElement(CITIES);
		const area = faker.number.int({ min: 400, max: 5000 });
		const askingPrice = area * faker.number.int({ min: 4000, max: 25000 });
		const createdAt = new Date(now - faker.number.int({ min: 0, max: 540 }) * DAY_MS);
		return {
			_id: oid(),
			propertyCode: encodePropertyCode(i + 1),
			title: `${faker.number.int({ min: 1, max: 5 })}BHK ${faker.location.street()}`,
			propertyType: faker.helpers.arrayElement(TYPES),
			status: faker.helpers.arrayElement(PROPERTY_STATUS),
			location: { city, cityKey: city.toLowerCase(), locality: faker.location.street(), pincode: faker.location.zipCode("######") },
			pricing: { askingPrice, pricePerSqft: Math.round(askingPrice / area) },
			specs: { area, bedrooms: faker.number.int({ min: 0, max: 5 }) },
			addedBy: faker.helpers.arrayElement(brokers)._id,
			revision: 0,
			createdAt,
			updatedAt: createdAt,
		};
	});
	await insertInBatches(db.collection("properties"), properties);

	const clients = [];
	const transitions = [];
	for (let i = 0; i < clientCount; i += 1) {
		const path = pickPath();
		const city = faker.helpers.arrayElement(CITIES);
		const minBudget = faker.number.int({ min: 20, max: 300 }) * 100000;
		const createdAt = new Date(now - faker.number.int({ min: 30, max: 540 }) * DAY_MS);
		const client = {
			_id: oid(),
			clientCode: encodeClientCode(i + 1),
			name: faker.person.fullName(),
			phone: faker.phone.number({ style: "national" }),
			email: faker.internet.email().toLowerCase(),
			assignedBroker: faker.helpers.arrayElement(brokers)._id,
			pipelineStage: path[path.length - 1],
			requirements: {
				propertyType: faker.helpers.arrayElement(TYPES),
				city,
				cityKey: city.toLowerCase(),
				minBudget,
				maxBudget: minBudget + faker.number.int({ min: 5, max: 100 }) * 100000,
				bedrooms: faker.number.int({ min: 1, max: 4 }),
			},
			revision: 0,
			createdAt,
			updatedAt: createdAt,
		};
		clients.push(client);

		let at = createdAt.getTime();
		path.forEach((to, step) => {
			if (step > 0) at += faker.number.int({ min: 1, max: 21 }) * DAY_MS;
			transitions.push({ _id: oid(), client: client._id, from: step ? path[step - 1] : null, to, changedBy: client.assignedBroker, via: "seed", backfilled: false, at: new Date(Math.min(at, now)) });
		});
	}
	await insertInBatches(db.collection("clients"), clients);
	await insertInBatches(db.collection("stagetransitions"), transitions);

	// Unique (client, property) pairs.
	const pairs = new Set();
	const matches = [];
	while (matches.length < matchCount) {
		const client = clients[faker.number.int({ min: 0, max: clients.length - 1 })];
		const property = properties[faker.number.int({ min: 0, max: properties.length - 1 })];
		const key = `${client._id}:${property._id}`;
		if (pairs.has(key)) continue;
		pairs.add(key);
		matches.push({ _id: oid(), client: client._id, property: property._id, interestLevel: faker.helpers.arrayElement(["high", "medium", "low"]), createdBy: client.assignedBroker, createdAt: client.createdAt, updatedAt: client.createdAt });
	}
	await insertInBatches(db.collection("matches"), matches);

	const requests = Array.from({ length: requestCount }, () => {
		const client = faker.helpers.arrayElement(clients);
		return { _id: oid(), entityType: "client", entityModel: "Client", entityId: client._id, requestedBy: client.assignedBroker, status: faker.helpers.arrayElement(["pending", "pending", "approved", "rejected"]), changes: [{ field: "requirements.maxBudget", oldValue: client.requirements.maxBudget, newValue: client.requirements.maxBudget + 500000 }], createdAt: new Date(now - faker.number.int({ min: 0, max: 90 }) * DAY_MS), updatedAt: new Date() };
	});
	await insertInBatches(db.collection("changerequests"), requests);

	const activity = Array.from({ length: activityCount }, () => {
		const client = faker.helpers.arrayElement(clients);
		return { _id: oid(), performedBy: client.assignedBroker, action: `Updated client ${client.name}`, entity: "client", entityId: client._id, createdAt: new Date(now - faker.number.int({ min: 0, max: 540 * 24 * 60 }) * 60000) };
	});
	await insertInBatches(db.collection("activitylogs"), activity);

	await db.collection("counters").insertMany([
		{ _id: "client", seq: clientCount },
		{ _id: "property", seq: propertyCount },
	]);

	return {
		admin,
		brokers,
		counts: {
			users: brokers.length + 1,
			clients: clients.length,
			properties: properties.length,
			stageTransitions: transitions.length,
			matches: matches.length,
			changeRequests: requests.length,
			activityLogs: activity.length,
		},
	};
};

module.exports = { generateSynthetic };

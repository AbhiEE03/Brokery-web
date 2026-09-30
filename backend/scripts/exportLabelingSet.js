/**
 * Builds a labelling set for evaluating matching quality (read-only):
 * up to 30 clients × 15 candidate properties each, in random order, so the
 * person grading isn't nudged by the scorer's ranking.
 *
 *   MONGO_URI=... node scripts/exportLabelingSet.js [outDir]
 *
 * Writes:
 *   labeling-set.json  snapshot of the clients and properties (used by evalMatching.js)
 *   labels.csv         one row per pair; fill the `grade` column with
 *                      0 = not relevant, 1 = maybe, 2 = strong fit
 */
require("dotenv").config({ quiet: true });
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Client = require("../models/Client");
const Property = require("../models/Property");
require("../models/Match");
require("../models/RecommendationEvent");
const { formatINR } = require("../utils/money");

const CLIENTS = 30;
const PER_CLIENT = 15;

const csvCell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

const main = async () => {
	const outDir = path.resolve(process.argv[2] || path.join(__dirname, "..", "bench", "matching"));
	await mongoose.connect(process.env.MONGO_URI);

	// Only what scoring and grading need: no names, phones or emails leave the database.
	const clients = await Client.find({ "requirements.cityKey": { $exists: true } })
		.select("clientCode requirements createdAt")
		.limit(200)
		.lean();
	const shuffled = clients.sort(() => crypto.randomInt(3) - 1).slice(0, CLIENTS);
	const pairs = [];
	const propertiesById = new Map();

	for (const client of shuffled) {
		// Same city, any status/price: graders should also see clearly bad options.
		const candidates = await Property.find({ "location.cityKey": client.requirements.cityKey })
			.select("propertyCode title propertyType status location pricing specs createdAt")
			.limit(200)
			.lean();
		const picked = candidates.sort(() => crypto.randomInt(3) - 1).slice(0, PER_CLIENT);
		picked.forEach((property) => {
			propertiesById.set(String(property._id), property);
			pairs.push({ client: String(client._id), property: String(property._id) });
		});
	}

	fs.mkdirSync(outDir, { recursive: true });
	fs.writeFileSync(
		path.join(outDir, "labeling-set.json"),
		JSON.stringify({ exportedAt: new Date().toISOString(), clients: shuffled, properties: [...propertiesById.values()], pairs }, null, 1),
	);

	const byId = new Map(shuffled.map((c) => [String(c._id), c]));
	const header = ["client", "property", "client_wants", "property_offers", "grade"];
	const rows = pairs.map(({ client, property }) => {
		const c = byId.get(client);
		const p = propertiesById.get(property);
		const r = c.requirements || {};
		const wants = `${c.clientCode} ${r.propertyType || "any type"}, ${r.locality || "any locality"}, ${formatINR(r.minBudget)}–${formatINR(r.maxBudget)}, ${r.bedrooms || "?"} BHK, ${r.minArea || "?"}–${r.maxArea || "?"} sq ft`;
		const offers = `${p.propertyCode} ${p.title} | ${p.propertyType}, ${p.location?.locality}, ${formatINR(p.pricing?.askingPrice)}, ${p.specs?.bedrooms ?? "?"} BHK, ${p.specs?.area ?? "?"} sq ft, ${p.status}`;
		return [client, property, wants, offers, ""].map(csvCell).join(",");
	});
	fs.writeFileSync(path.join(outDir, "labels.csv"), [header.join(","), ...rows].join("\n"));

	console.log(`Wrote ${pairs.length} pairs for ${shuffled.length} clients to ${outDir}`);
	await mongoose.disconnect();
};

main().catch((error) => {
	console.error(error);
	process.exit(1);
});

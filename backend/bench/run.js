/**
 * API latency benchmark: same dataset, same requests, measured twice —
 * once with only _id indexes, once with the schema's indexes.
 *
 *   npm run bench            # 100k clients (default)
 *   BENCH_CLIENTS=20000 npm run bench
 *
 * Runs entirely against a throwaway in-memory replica set; never touches .env.
 */
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");

process.env.LOG_LEVEL = "silent";
process.env.RATE_LIMIT_PER_MINUTE = "1000000000";
process.env.JWT_SECRET = crypto.randomBytes(32).toString("hex");
process.env.CLIENT_URL = "http://localhost:5173";

const autocannon = require("autocannon");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const { generateSynthetic } = require("../scripts/generateSynthetic");

const MODELS = ["User", "Client", "Property", "Match", "ChangeRequest", "StageTransition", "AuditLog", "Notification", "Counter"];
MODELS.forEach((name) => require(`../models/${name}`));

const DURATION = Number(process.env.BENCH_DURATION || 6);
const CONNECTIONS = Number(process.env.BENCH_CONNECTIONS || 10);

const run = (url, token) =>
	new Promise((resolve, reject) => {
		autocannon(
			{ url, connections: CONNECTIONS, duration: DURATION, headers: { authorization: `Bearer ${token}` } },
			(error, result) => (error ? reject(error) : resolve(result)),
		);
	});

const main = async () => {
	const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
	await mongoose.connect(replSet.getUri("bench"));
	const db = mongoose.connection.db;

	const started = Date.now();
	const { admin, brokers, counts } = await generateSynthetic({
		db,
		clients: Number(process.env.BENCH_CLIENTS || 100000),
		properties: Number(process.env.BENCH_PROPERTIES || 30000),
		matches: Number(process.env.BENCH_MATCHES || 50000),
		activity: Number(process.env.BENCH_ACTIVITY || 100000),
	});
	console.log(`Generated in ${((Date.now() - started) / 1000).toFixed(1)}s`, counts);

	const createApp = require("../app");
	const server = createApp().listen(0);
	const base = `http://127.0.0.1:${server.address().port}`;
	const token = (user) => jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);
	const adminToken = token(admin);
	const brokerToken = token(brokers[0]);

	// Cursor pointing ~40k rows deep, to compare offset vs keyset at the same depth.
	const deep = await db.collection("auditlogs").find().sort({ seq: -1 }).skip(39999).limit(1).next();
	const deepCursor = deep.seq;

	// A real word from the dataset for the search scenario.
	const sample = await db.collection("properties").findOne({}, { projection: { title: 1 } });
	const searchWord = sample.title.split(" ").filter((w) => /^[A-Za-z]{4,}$/.test(w)).pop() || "Road";

	const scenarios = [
		["Broker's client list (own clients, newest first)", "/api/clients?limit=20", brokerToken],
		["Clients by stage (admin)", "/api/clients?stage=negotiation&limit=20", adminToken],
		["Available properties in a city", "/api/properties?city=pune&status=available&limit=20", brokerToken],
		[`Property search "${searchWord}" (text index; substring scan without it)`, `/api/properties?search=${encodeURIComponent(searchWord)}&limit=20`, brokerToken],
		["Properties by price range", "/api/properties?minPrice=5000000&maxPrice=6000000&limit=20", brokerToken],
		["Pending approvals queue", "/api/change-requests?status=pending&limit=20", adminToken],
		["Broker's matches", "/api/matches?limit=20", brokerToken],
		["Activity feed, page 1", "/api/activity?limit=20", adminToken],
		["Activity feed, offset page 2000", "/api/activity?limit=20&page=2000", adminToken],
		["Activity feed, keyset cursor at the same depth", `/api/activity?limit=20&cursor=${deepCursor}`, adminToken],
		["Dashboard summary", "/api/analytics/summary", adminToken],
		["Closures by month (stage events)", "/api/analytics/deals-by-month", adminToken],
		["Broker performance", "/api/analytics/broker-performance", adminToken],
	];

	const measure = async (label) => {
		const results = [];
		for (const [name, url, auth] of scenarios) {
			const r = await run(base + url, auth);
			if (r.non2xx) throw new Error(`${name}: ${r.non2xx} non-2xx responses`);
			results.push({ name, p50: r.latency.p50, p975: r.latency.p97_5, p99: r.latency.p99, rps: Math.round(r.requests.average) });
			console.log(`[${label}] ${name}: p50 ${r.latency.p50}ms p97.5 ${r.latency.p97_5}ms p99 ${r.latency.p99}ms ${Math.round(r.requests.average)} req/s`);
		}
		return results;
	};

	for (const name of await db.listCollections().toArray()) {
		await db.collection(name.name).dropIndexes();
	}
	const withoutIndexes = await measure("no indexes");

	await mongoose.connection.syncIndexes();
	const withIndexes = await measure("indexed");

	const mongoVersion = (await db.admin().serverInfo()).version;
	server.close();
	await mongoose.disconnect();
	await replSet.stop();

	const date = new Date().toISOString().slice(0, 10);
	const speedup = (a, b) => (b.p50 > 0 ? `${(a.p50 / b.p50).toFixed(1)}×` : "—");
	const rows = withoutIndexes.map((before, i) => {
		const after = withIndexes[i];
		return `| ${before.name} | ${before.p50} | ${before.p975} | ${before.p99} | ${after.p50} | ${after.p975} | ${after.p99} | ${speedup(before, after)} | ${before.rps} → ${after.rps} |`;
	});

	const report = `# Benchmark ${date}

Same dataset and requests measured twice: with only \`_id\` indexes, then with the schema indexes.
Latencies in milliseconds (autocannon, ${CONNECTIONS} connections, ${DURATION}s per scenario, single run). autocannon reports p97.5 rather than p95.

**Dataset:** ${Object.entries(counts).map(([k, v]) => `${v.toLocaleString("en-US")} ${k}`).join(", ")}.
Broker scenarios use one of ${brokers.length} brokers (~${Math.round(counts.clients / brokers.length).toLocaleString("en-US")} clients each).

**Machine:** ${os.cpus()[0].model.trim()} (${os.cpus().length} threads), ${Math.round(os.totalmem() / 1024 ** 3)} GB RAM, ${os.type()} ${os.release()}, Node ${process.version}, MongoDB ${mongoVersion} (in-memory replica set on the same machine).

| Scenario | p50 before | p97.5 before | p99 before | p50 after | p97.5 after | p99 after | p50 speed-up | req/s before → after |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
${rows.join("\n")}

Caveats: one run on a developer laptop with the database on the same machine and no network hop. Treat the numbers as relative (before vs after), not as production capacity.
`;

	const outDir = path.join(__dirname, "results");
	fs.mkdirSync(outDir, { recursive: true });
	const outFile = path.join(outDir, `${date}.md`);
	fs.writeFileSync(outFile, report);
	console.log(`\nWrote ${outFile}\n\n${report}`);
};

main().catch((error) => {
	console.error(error);
	process.exit(1);
});

/**
 * Offline evaluation of matching quality against human labels.
 *
 *   node scripts/evalMatching.js [dir]   (dir defaults to bench/matching)
 *
 * Reads labeling-set.json + labels.csv (from exportLabelingSet.js, with the
 * grade column filled in). Clients are split deterministically: two thirds to
 * tune the weights (grid search, step 0.1), one third held out. Reports
 * precision@5 and NDCG@10 on the held-out clients for:
 *   random order · price-distance baseline · default weights · tuned weights
 * and writes results.md next to the inputs.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { scoreMatch } = require("../services/matchingService");
const config = require("../config/matchingWeights");
const { precisionAtK, ndcgAtK, mean } = require("../utils/rankingMetrics");

const FEATURES = Object.keys(config.weights);

const parseCsv = (text) => {
	const rows = [];
	for (const line of text.split(/\r?\n/).filter(Boolean)) {
		const cells = [];
		let cell = "";
		let quoted = false;
		for (let i = 0; i < line.length; i += 1) {
			const ch = line[i];
			if (quoted && ch === '"' && line[i + 1] === '"') {
				cell += '"';
				i += 1;
			} else if (ch === '"') quoted = !quoted;
			else if (ch === "," && !quoted) {
				cells.push(cell);
				cell = "";
			} else cell += ch;
		}
		cells.push(cell);
		rows.push(cells);
	}
	return rows;
};

// Every weight vector on a 0.1 grid that sums to 1 (1001 of them for 5 features).
const weightGrid = (n = FEATURES.length, steps = 10) => {
	if (n === 1) return [[steps]];
	const out = [];
	for (let i = 0; i <= steps; i += 1) for (const rest of weightGrid(n - 1, steps - i)) out.push([i, ...rest]);
	return out;
};

const seededRandom = (seed) => () => {
	seed = (seed * 1664525 + 1013904223) % 2 ** 32;
	return seed / 2 ** 32;
};

const evaluate = (groups, rankFn, k) => ({
	precision5: mean(groups.map((g) => precisionAtK(rankFn(g).map((pair) => pair.grade), 5))),
	ndcg10: mean(groups.map((g) => ndcgAtK(rankFn(g).map((pair) => pair.grade), k))),
});

const main = () => {
	const dir = path.resolve(process.argv[2] || path.join(__dirname, "..", "bench", "matching"));
	const set = JSON.parse(fs.readFileSync(path.join(dir, "labeling-set.json"), "utf8"));
	const [header, ...rows] = parseCsv(fs.readFileSync(path.join(dir, "labels.csv"), "utf8"));
	const col = (name) => header.indexOf(name);

	const labelled = rows
		.map((r) => ({ client: r[col("client")], property: r[col("property")], grade: r[col("grade")].trim() }))
		.filter((r) => r.grade !== "");
	if (!labelled.length) {
		console.error("No grades found: fill the `grade` column of labels.csv with 0, 1 or 2 first.");
		process.exit(1);
	}

	const now = Date.parse(set.exportedAt);
	const clients = new Map(set.clients.map((c) => [String(c._id), c]));
	const properties = new Map(set.properties.map((p) => [String(p._id), p]));

	// One group per client: its labelled pairs, each with the per-feature values precomputed.
	const groups = new Map();
	for (const row of labelled) {
		const client = clients.get(row.client);
		const property = properties.get(row.property);
		const { breakdown } = scoreMatch(client, property, { now });
		const values = Object.fromEntries(breakdown.map((f) => [f.feature, f.value]));
		const r = client.requirements || {};
		const mid = ((r.minBudget ?? r.maxBudget ?? 0) + (r.maxBudget ?? r.minBudget ?? 0)) / 2;
		const pair = { grade: Number(row.grade), values, priceDistance: Math.abs((property.pricing?.askingPrice ?? Infinity) - mid) };
		if (!groups.has(row.client)) groups.set(row.client, []);
		groups.get(row.client).push(pair);
	}

	// Deterministic split by client id hash: 2/3 tune, 1/3 held out.
	const ordered = [...groups.entries()].sort(([a], [b]) =>
		crypto.createHash("sha1").update(a).digest("hex").localeCompare(crypto.createHash("sha1").update(b).digest("hex")),
	);
	const cut = Math.max(1, Math.round((ordered.length * 2) / 3));
	const train = ordered.slice(0, cut).map(([, g]) => g);
	const test = ordered.slice(cut).map(([, g]) => g);
	if (!test.length) {
		console.error("Need labels for at least 2 clients to hold some out.");
		process.exit(1);
	}

	const byWeights = (weights) => (group) =>
		[...group].sort(
			(a, b) =>
				FEATURES.reduce((s, f, i) => s + weights[i] * b.values[f], 0) -
				FEATURES.reduce((s, f, i) => s + weights[i] * a.values[f], 0),
		);

	let best = { ndcg: -1, weights: null };
	for (const vector of weightGrid()) {
		const weights = vector.map((w) => w / 10);
		const { ndcg10 } = evaluate(train, byWeights(weights), 10);
		if (ndcg10 > best.ndcg) best = { ndcg: ndcg10, weights };
	}

	const random = seededRandom(42);
	const results = [
		["Random order", evaluate(test, (g) => [...g].sort(() => random() - 0.5), 10)],
		["Price distance from budget midpoint", evaluate(test, (g) => [...g].sort((a, b) => a.priceDistance - b.priceDistance), 10)],
		["Scorer, default weights", evaluate(test, byWeights(FEATURES.map((f) => config.weights[f])), 10)],
		["Scorer, tuned weights", evaluate(test, byWeights(best.weights), 10)],
	];

	const table = [
		"| Ranker | precision@5 | NDCG@10 |",
		"|---|---:|---:|",
		...results.map(([name, m]) => `| ${name} | ${m.precision5.toFixed(3)} | ${m.ndcg10.toFixed(3)} |`),
	].join("\n");
	const tuned = FEATURES.map((f, i) => `${f} ${best.weights[i].toFixed(1)}`).join(", ");
	const report = `# Matching evaluation

${labelled.length} labelled pairs for ${groups.size} clients (${train.length} used to tune weights, ${test.length} held out).
Scores below are on the held-out clients only. "Relevant" for precision means grade ≥ 1.

${table}

Tuned weights (grid search, step 0.1, on the tuning clients): ${tuned}.
`;
	fs.writeFileSync(path.join(dir, "results.md"), report);
	console.log(report);
};

main();

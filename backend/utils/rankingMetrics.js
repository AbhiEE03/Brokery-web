/**
 * Ranking-quality metrics for matching evaluation. `grades` are the human
 * relevance labels (0 = not relevant, 1 = maybe, 2 = strong fit) of the
 * results in the order the ranker returned them.
 */

// Share of the top k results that are relevant (grade ≥ minGrade).
const precisionAtK = (grades, k, minGrade = 1) => {
	if (k <= 0) return 0;
	const top = grades.slice(0, k);
	return top.filter((g) => g >= minGrade).length / k;
};

// Discounted cumulative gain with the standard (2^grade - 1) gain.
const dcg = (grades, k) =>
	grades.slice(0, k).reduce((sum, grade, i) => sum + (2 ** grade - 1) / Math.log2(i + 2), 0);

// DCG divided by the best possible DCG for these labels: 1 = perfect order.
const ndcgAtK = (grades, k) => {
	const ideal = dcg([...grades].sort((a, b) => b - a), k);
	return ideal === 0 ? 0 : dcg(grades, k) / ideal;
};

const mean = (values) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

module.exports = { precisionAtK, ndcgAtK, dcg, mean };

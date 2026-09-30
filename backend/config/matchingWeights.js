/**
 * Tunables for client ↔ property matching. Weights sum to 1, so a score is a
 * number between 0 and 1. Change them here (or with scripts/evalMatching.js,
 * which grid-searches them against labelled data), not in the scorer.
 */
module.exports = {
	weights: {
		budget: 0.35,
		locality: 0.2,
		area: 0.15,
		bedrooms: 0.15,
		freshness: 0.15,
	},
	// Candidate retrieval: properties up to 10% over the client's max budget.
	budgetStretch: 1.1,
	maxCandidates: 500,
	// A listing loses half its freshness score every 30 days.
	freshnessHalfLifeDays: 30,
	// Re-match alerts fire when a change lifts a client's score to at least this.
	alertThreshold: 0.6,
};

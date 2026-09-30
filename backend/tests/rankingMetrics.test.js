const { precisionAtK, ndcgAtK } = require("../utils/rankingMetrics");

describe("ranking metrics", () => {
	test("precision@k counts relevant results in the top k", () => {
		expect(precisionAtK([2, 0, 1, 0, 0, 2], 5)).toBe(0.4);
		expect(precisionAtK([2, 0, 1], 5)).toBe(0.4); // missing results count as misses
		expect(precisionAtK([2, 1, 1], 3, 2)).toBeCloseTo(1 / 3);
	});

	test("NDCG is 1 for the ideal order and lower when good results sink", () => {
		expect(ndcgAtK([2, 2, 1, 0], 10)).toBe(1);
		expect(ndcgAtK([0, 1, 2, 2], 10)).toBeLessThan(ndcgAtK([2, 0, 1, 2], 10));
		// Worked example: gains 3,0,1 → DCG = 3/1 + 0 + 1/2 = 3.5; ideal 3,1,0 → 3 + 1/log2(3).
		expect(ndcgAtK([2, 0, 1], 3)).toBeCloseTo(3.5 / (3 + 1 / Math.log2(3)), 6);
		expect(ndcgAtK([0, 0], 10)).toBe(0);
	});
});

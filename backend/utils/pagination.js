const MAX_LIMIT = 100;

const toSkip = ({ page, limit }) => (page - 1) * limit;

const paginationMeta = ({ page, limit }, total) => ({
	page,
	limit,
	total,
	pages: Math.max(1, Math.ceil(total / limit)),
});

module.exports = { MAX_LIMIT, toSkip, paginationMeta };

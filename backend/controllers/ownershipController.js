const OwnershipClaim = require("../models/OwnershipClaim");
const { toSkip, paginationMeta } = require("../utils/pagination");
const { resolveClaim } = require("../services/ownershipService");

const populateClaim = (query) =>
	query
		.populate("existingClient", "name clientCode phone email assignedBroker createdAt")
		.populate("existingBroker", "name email")
		.populate("claimant", "name email")
		.populate("resolvedBy", "name email");

exports.getClaims = async (req, res) => {
	const { status, page, limit } = req.validated.query;
	const filter = status ? { status } : {};

	const [claims, total] = await Promise.all([
		populateClaim(OwnershipClaim.find(filter))
			.sort({ createdAt: -1, _id: -1 })
			.skip(toSkip({ page, limit }))
			.limit(limit)
			.lean(),
		OwnershipClaim.countDocuments(filter),
	]);

	res.status(200).json({ success: true, data: claims, pagination: paginationMeta({ page, limit }, total) });
};

exports.resolveClaim = async (req, res) => {
	const claim = await resolveClaim({
		id: req.validated.params.id,
		decision: req.body.decision,
		note: req.body.note,
		actor: req.user,
	});
	const populated = await populateClaim(OwnershipClaim.findById(claim._id)).lean();
	res.status(200).json({
		success: true,
		message: claim.status === "transferred" ? "Client transferred to the claimant" : "Existing broker keeps the client",
		data: populated,
	});
};

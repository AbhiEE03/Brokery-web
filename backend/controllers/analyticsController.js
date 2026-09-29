const Client = require("../models/Client");
const Property = require("../models/Property");
const User = require("../models/User");
const ChangeRequest = require("../models/ChangeRequest");
const StageTransition = require("../models/StageTransition");

// Forward pipeline order; "lost" can happen from any stage and is excluded.
const FUNNEL_STAGES = ["lead", "contacted", "site_visit", "negotiation", "closed"];
const DAY_MS = 24 * 60 * 60 * 1000;

const median = (values) => {
	if (!values.length) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const round1 = (value) => (value === null ? null : Math.round(value * 10) / 10);

exports.getSummary = async (req, res) => {
	const [clientStats, propertyStats, pendingApprovals, activeBrokers] = await Promise.all([
		Client.aggregate([{ $group: { _id: "$pipelineStage", count: { $sum: 1 } } }]),
		Property.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
		ChangeRequest.countDocuments({ status: "pending" }),
		User.countDocuments({ role: "broker", isActive: true }),
	]);

	const countOf = (stats, key) => stats.find((item) => item._id === key)?.count || 0;
	const sum = (stats) => stats.reduce((total, item) => total + item.count, 0);

	res.status(200).json({
		success: true,
		data: {
			totalClients: sum(clientStats),
			closedDeals: countOf(clientStats, "closed"),
			totalProperties: sum(propertyStats),
			activeListings: countOf(propertyStats, "available"),
			pendingApprovals,
			activeBrokers,
		},
	});
};

// Closures per month for the last 12 months, from stage-transition events
// (not the client's updatedAt, which moves on any later edit). Months with no
// closures are returned as 0 so the chart has a continuous axis.
exports.getDealsByMonth = async (req, res) => {
	const now = new Date();
	const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));

	const rows = await StageTransition.aggregate([
		{ $match: { to: "closed", at: { $gte: start } } },
		{
			$group: {
				_id: { year: { $year: "$at" }, month: { $month: "$at" } },
				count: { $sum: 1 },
			},
		},
	]);

	const byKey = new Map(rows.map((row) => [`${row._id.year}-${row._id.month}`, row.count]));
	const data = Array.from({ length: 12 }, (_, i) => {
		const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
		const year = date.getUTCFullYear();
		const month = date.getUTCMonth() + 1;
		return { _id: { year, month }, count: byKey.get(`${year}-${month}`) || 0 };
	});

	res.status(200).json({ success: true, data });
};

exports.getPipelineDistribution = async (req, res) => {
	const data = await Client.aggregate([
		{ $group: { _id: "$pipelineStage", count: { $sum: 1 } } },
		{ $sort: { count: -1 } },
	]);

	res.status(200).json({ success: true, data });
};

// Conversion = closed ÷ (closed + lost): only clients whose outcome is known.
// Counting open leads in the denominator would penalise brokers with fresh pipelines.
exports.getBrokerPerformance = async (req, res) => {
	const data = await Client.aggregate([
		{
			$group: {
				_id: "$assignedBroker",
				total: { $sum: 1 },
				closed: { $sum: { $cond: [{ $eq: ["$pipelineStage", "closed"] }, 1, 0] } },
				lost: { $sum: { $cond: [{ $eq: ["$pipelineStage", "lost"] }, 1, 0] } },
			},
		},
		{
			$lookup: {
				from: "users",
				localField: "_id",
				foreignField: "_id",
				as: "broker",
			},
		},
		{ $unwind: { path: "$broker", preserveNullAndEmptyArrays: true } },
		{
			$project: {
				brokerName: { $ifNull: ["$broker.name", "Unassigned"] },
				total: 1,
				closed: 1,
				lost: 1,
				open: { $subtract: ["$total", { $add: ["$closed", "$lost"] }] },
				conversionRate: {
					$cond: [
						{ $gt: [{ $add: ["$closed", "$lost"] }, 0] },
						{
							$round: [
								{ $multiply: [{ $divide: ["$closed", { $add: ["$closed", "$lost"] }] }, 100] },
								1,
							],
						},
						null,
					],
				},
			},
		},
		{ $sort: { closed: -1, total: -1 } },
	]);

	res.status(200).json({ success: true, data });
};

// How many clients reached each stage (a client that reached "negotiation"
// also counts as having reached every earlier stage).
exports.getFunnel = async (req, res) => {
	const rows = await StageTransition.aggregate([
		{ $match: { to: { $in: FUNNEL_STAGES } } },
		{
			$group: {
				_id: "$client",
				furthest: { $max: { $indexOfArray: [FUNNEL_STAGES, "$to"] } },
			},
		},
		{ $group: { _id: "$furthest", clients: { $sum: 1 } } },
	]);

	const reachedExactly = new Map(rows.map((row) => [row._id, row.clients]));
	let cumulative = 0;
	const data = FUNNEL_STAGES.map((stage, index) => ({ stage, index }))
		.reverse()
		.map(({ stage, index }) => {
			cumulative += reachedExactly.get(index) || 0;
			return { stage, clients: cumulative };
		})
		.reverse()
		.map((row, index, all) => ({
			...row,
			fromPrevious:
				index === 0 || !all[index - 1].clients ?
					null
				:	round1((row.clients / all[index - 1].clients) * 100),
		}));

	res.status(200).json({ success: true, data });
};

// Median days spent in each stage, from consecutive transitions of the same
// client. Stages a client is still in are excluded (their stay isn't over).
exports.getTimeInStage = async (req, res) => {
	const rows = await StageTransition.aggregate([
		{
			$setWindowFields: {
				partitionBy: "$client",
				sortBy: { at: 1 },
				output: { leftAt: { $shift: { output: "$at", by: 1 } } },
			},
		},
		{ $match: { leftAt: { $ne: null }, backfilled: { $ne: true } } },
		{
			$group: {
				_id: "$to",
				days: { $push: { $divide: [{ $subtract: ["$leftAt", "$at"] }, DAY_MS] } },
			},
		},
	]);

	const byStage = new Map(rows.map((row) => [row._id, row.days]));
	const data = FUNNEL_STAGES.filter((stage) => stage !== "closed").map((stage) => {
		const days = byStage.get(stage) || [];
		return { stage, medianDays: round1(median(days)), samples: days.length };
	});

	res.status(200).json({ success: true, data });
};

exports.getPropertyByCity = async (req, res) => {
	const data = await Property.aggregate([
		{ $match: { status: "available" } },
		{
			$group: {
				_id: { $ifNull: ["$location.cityKey", { $toLower: "$location.city" }] },
				label: { $first: "$location.city" },
				count: { $sum: 1 },
			},
		},
		{ $project: { _id: "$label", count: 1 } },
		{ $sort: { count: -1 } },
	]);

	res.status(200).json({ success: true, data });
};

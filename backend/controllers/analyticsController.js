const Client = require("../models/Client");
const Property = require("../models/Property");
const ClientChangeRequest = require("../models/ClientChangeRequest");

exports.getSummary = async (req, res) => {
	try {
		const [clientStats, propertyStats, pendingRequests, totalClients] =
			await Promise.all([
				Client.aggregate([
					{
						$group: {
							_id: "$pipelineStage",
							count: { $sum: 1 },
						},
					},
				]),
				Property.aggregate([
					{
						$group: {
							_id: "$status",
							count: { $sum: 1 },
						},
					},
				]),
				ClientChangeRequest.countDocuments({ status: "pending" }),
				Client.countDocuments(),
			]);

		const closedDeals =
			clientStats.find((item) => item._id === "closed")?.count || 0;
		const activeListings =
			propertyStats.find((item) => item._id === "available")?.count || 0;

		res.status(200).json({
			success: true,
			data: {
				totalClients,
				closedDeals,
				activeListings,
				pendingApprovals: pendingRequests,
			},
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

exports.getDealsByMonth = async (req, res) => {
	try {
		const twelveMonthsAgo = new Date();
		twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

		const data = await Client.aggregate([
			{
				$match: {
					pipelineStage: "closed",
					updatedAt: { $gte: twelveMonthsAgo },
				},
			},
			{
				$group: {
					_id: {
						year: { $year: "$updatedAt" },
						month: { $month: "$updatedAt" },
					},
					count: { $sum: 1 },
				},
			},
			{ $sort: { "_id.year": 1, "_id.month": 1 } },
		]);

		res.status(200).json({
			success: true,
			data,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

exports.getPipelineDistribution = async (req, res) => {
	try {
		const data = await Client.aggregate([
			{
				$group: {
					_id: "$pipelineStage",
					count: { $sum: 1 },
				},
			},
			{ $sort: { count: -1 } },
		]);

		res.status(200).json({
			success: true,
			data,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

exports.getBrokerPerformance = async (req, res) => {
	try {
		const data = await Client.aggregate([
			{
				$group: {
					_id: "$assignedBroker",
					total: { $sum: 1 },
					closed: {
						$sum: {
							$cond: [{ $eq: ["$pipelineStage", "closed"] }, 1, 0],
						},
					},
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
			{ $unwind: "$broker" },
			{
				$project: {
					brokerName: "$broker.name",
					total: 1,
					closed: 1,
					conversionRate: {
						$round: [
							{
								$multiply: [{ $divide: ["$closed", "$total"] }, 100],
							},
							1,
						],
					},
				},
			},
			{ $sort: { closed: -1 } },
		]);

		res.status(200).json({
			success: true,
			data,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

exports.getPropertyByCity = async (req, res) => {
	try {
		const data = await Property.aggregate([
			{ $match: { status: "available" } },
			{ $group: { _id: "$location.city", count: { $sum: 1 } } },
			{ $sort: { count: -1 } },
		]);

		res.status(200).json({
			success: true,
			data,
		});
	} catch (error) {
		res.status(500).json({
			success: false,
			message: error.message,
		});
	}
};

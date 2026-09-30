/**
 * Creating a client ↔ property link. Used by the Matches page, by one-click
 * "create match" on a recommendation, and by buyer feedback on shortlist links,
 * so every path writes the same audit entry.
 */
const mongoose = require("mongoose");
const Match = require("../models/Match");
const RecommendationEvent = require("../models/RecommendationEvent");
const { HttpError } = require("../utils/httpError");
const audit = require("./auditService");

const inTransaction = (session, fn) => (session ? fn(session) : mongoose.connection.transaction(fn));

const matchLabel = (client, property) => `${client?.name || "client"} ↔ ${property?.title || "property"}`;

/**
 * @param recommendation optional { rank, score }: the match came from a recommendation.
 */
const createMatch = async ({ client, property, interestLevel, notes, actor, session, recommendation, via }) =>
	inTransaction(session, async (s) => {
		if (await Match.exists({ client: client._id, property: property._id }).session(s)) {
			throw new HttpError(409, "This client-property match already exists", { code: "MATCH_EXISTS" });
		}
		const [match] = await Match.create(
			[{ client: client._id, property: property._id, interestLevel, notes, createdBy: actor._id }],
			{ session: s },
		);
		if (recommendation) {
			await RecommendationEvent.create(
				[{ client: client._id, property: property._id, broker: actor._id, action: "linked", ...recommendation }],
				{ session: s },
			);
		}
		await audit.record(
			{
				actor: actor._id,
				action: "match.create",
				entityType: "match",
				entityId: match._id,
				subject: { type: "client", id: client._id },
				summary: `Linked ${matchLabel(client, property)} (${interestLevel} interest)${via ? ` via ${via}` : ""}`,
				after: {
					client: client._id,
					property: property._id,
					interestLevel,
					notes: notes ?? null,
					...(recommendation ? { recommendation } : {}),
				},
			},
			{ session: s },
		);
		return match;
	});

module.exports = { createMatch, matchLabel };

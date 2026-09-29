const mongoose = require("mongoose");

/**
 * Soft delete: documents get deletedAt/deletedBy instead of being removed, and
 * are hidden from every query and aggregation unless the caller opts in with
 * `.setOptions({ withDeleted: true })` (or `{ withDeleted: true }` for aggregate).
 *
 * Note: $lookup stages from *other* collections don't pass through this
 * middleware and must filter on deletedAt themselves.
 */
const QUERY_HOOKS = [
	"find",
	"findOne",
	"countDocuments",
	"findOneAndUpdate",
	"updateOne",
	"updateMany",
	"distinct",
];

module.exports = function softDelete(schema) {
	schema.add({
		deletedAt: { type: Date },
		deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
	});

	schema.pre(QUERY_HOOKS, function () {
		if (this.getOptions().withDeleted) return;
		if (this.getFilter().deletedAt === undefined) {
			this.where({ deletedAt: null });
		}
	});

	schema.pre("aggregate", function () {
		if (this.options?.withDeleted) return;
		this.pipeline().unshift({ $match: { deletedAt: null } });
	});

	schema.methods.softDelete = function (actor, { session } = {}) {
		this.deletedAt = new Date();
		this.deletedBy = actor?._id;
		return this.save({ session });
	};
};

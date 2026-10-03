/**
 * Team management for admins: onboarding and offboarding brokers.
 *
 * - Deactivating someone takes effect on their very next request (verifyToken
 *   re-reads the user), and a password reset revokes every existing session by
 *   bumping tokenVersion, which is embedded in each JWT.
 * - Offboarding moves a leaving broker's clients to someone else in one
 *   transaction, each transfer going through the approval engine so it's
 *   audited like any other ownership change.
 * - Guard rails: you can't deactivate yourself, and the last active admin can't
 *   be deactivated, even by two admins racing each other.
 */
const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("../models/User");
const Client = require("../models/Client");
const Counter = require("../models/Counter");
const { HttpError } = require("../utils/httpError");
const { sameId } = require("../policies");
const audit = require("./auditService");

const ADMIN_ROSTER = "admin-roster";

// 16 characters from an unambiguous alphabet (no 0/O, 1/l/I), with every class present.
const generatePassword = () => {
	const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnpqrstuvwxyz", "23456789", "@#%*-_+="];
	const all = sets.join("");
	const chars = sets.map((set) => set[crypto.randomInt(set.length)]);
	while (chars.length < 16) chars.push(all[crypto.randomInt(all.length)]);
	for (let i = chars.length - 1; i > 0; i -= 1) {
		const j = crypto.randomInt(i + 1);
		[chars[i], chars[j]] = [chars[j], chars[i]];
	}
	return chars.join("");
};

const publicUser = (user) => ({
	_id: user._id,
	name: user.name,
	email: user.email,
	role: user.role,
	isActive: user.isActive,
	createdAt: user.createdAt,
});

const loadUser = async (id, session) => {
	const user = await User.findById(id).session(session || null);
	if (!user) throw new HttpError(404, "User not found");
	return user;
};

/** Brokers with how many live clients (and open, not closed/lost) each one has. */
const listBrokers = async ({ includeInactive = false } = {}) => {
	const brokers = await User.find({ role: "broker", ...(includeInactive ? {} : { isActive: true }) })
		.select("name email role isActive createdAt")
		.sort({ isActive: -1, name: 1 })
		.lean();
	const counts = await Client.aggregate([
		{ $match: { assignedBroker: { $in: brokers.map((b) => b._id) } } },
		{
			$group: {
				_id: "$assignedBroker",
				clients: { $sum: 1 },
				open: { $sum: { $cond: [{ $in: ["$pipelineStage", ["closed", "lost"]] }, 0, 1] } },
			},
		},
	]);
	const byBroker = new Map(counts.map((c) => [String(c._id), c]));
	return brokers.map((b) => ({
		...publicUser(b),
		clientCount: byBroker.get(String(b._id))?.clients || 0,
		openClientCount: byBroker.get(String(b._id))?.open || 0,
	}));
};

const createUser = async ({ name, email, password, role = "broker", actor }) => {
	if (await User.exists({ email })) {
		throw new HttpError(409, "An account with this email already exists", { code: "USER_EXISTS" });
	}
	const generatedPassword = password ? null : generatePassword();
	let user;
	await mongoose.connection.transaction(async (session) => {
		[user] = await User.create([{ name, email, password: password || generatedPassword, role }], { session });
		await audit.record(
			{
				actor: actor._id,
				action: "user.create",
				entityType: "user",
				entityId: user._id,
				summary: `Created ${role} account ${name} <${email}>`,
				after: { name, email, role },
			},
			{ session },
		);
	});
	// The generated password is returned once and never stored in plain text or logged.
	return { user: publicUser(user), generatedPassword };
};

const setStatus = async ({ userId, isActive, actor }) => {
	if (!isActive && sameId(userId, actor._id)) {
		throw new HttpError(409, "You can't deactivate your own account", { code: "CANNOT_DEACTIVATE_SELF" });
	}

	let user;
	await mongoose.connection.transaction(async (session) => {
		user = await loadUser(userId, session);
		if (user.isActive === isActive) return;

		if (!isActive && user.role === "admin") {
			// Every admin deactivation writes this one document, so two concurrent ones
			// write-conflict and run one after the other: the second sees the first.
			await Counter.updateOne({ _id: ADMIN_ROSTER }, { $inc: { seq: 1 } }, { upsert: true, session });
			const activeAdmins = await User.countDocuments({ role: "admin", isActive: true }).session(session);
			if (activeAdmins <= 1) {
				throw new HttpError(409, "There must always be at least one active admin", { code: "LAST_ADMIN" });
			}
		}

		user.isActive = isActive;
		await user.save({ session });
		await audit.record(
			{
				actor: actor._id,
				action: isActive ? "user.reactivate" : "user.deactivate",
				entityType: "user",
				entityId: user._id,
				summary: `${isActive ? "Reactivated" : "Deactivated"} ${user.role} account ${user.name} <${user.email}>`,
				before: { isActive: !isActive },
				after: { isActive },
			},
			{ session },
		);
	});
	return publicUser(user);
};

const resetPassword = async ({ userId, actor }) => {
	const temporaryPassword = generatePassword();
	let user;
	await mongoose.connection.transaction(async (session) => {
		user = await loadUser(userId, session);
		user.password = temporaryPassword; // hashed by the model's pre-save hook
		user.tokenVersion = (user.tokenVersion || 0) + 1; // every existing session ends now
		await user.save({ session });
		await audit.record(
			{
				actor: actor._id,
				action: "user.password_reset",
				entityType: "user",
				entityId: user._id,
				summary: `Reset the password of ${user.name} <${user.email}> and signed them out everywhere`,
			},
			{ session },
		);
	});
	return { user: publicUser(user), temporaryPassword };
};

/**
 * Moves every live client of `fromId` to `toBrokerId` in one transaction. Each
 * move is an admin edit through the approval engine (audited per client); any
 * failure rolls all of them back.
 */
const reassignClients = async ({ fromId, toBrokerId, actor }) => {
	if (sameId(fromId, toBrokerId)) {
		throw new HttpError(400, "Pick a different broker to take over these clients", { code: "SAME_BROKER" });
	}
	// Required lazily: approvalService pulls in services that require this module's neighbours.
	const { proposeChanges } = require("./approvalService");

	let moved = 0;
	let from;
	let to;
	await mongoose.connection.transaction(async (session) => {
		moved = 0;
		from = await loadUser(fromId, session);
		to = await User.findOne({ _id: toBrokerId, role: "broker", isActive: true }).session(session);
		if (!to) throw new HttpError(400, "Clients can only go to an active broker", { code: "INVALID_BROKER" });

		const clients = await Client.find({ assignedBroker: from._id }).select("_id").session(session).lean();
		for (const client of clients) {
			await proposeChanges({
				entityType: "client",
				entityId: client._id,
				patch: { assignedBroker: to._id.toString() },
				actor,
				session,
			});
			moved += 1;
		}

		await audit.record(
			{
				actor: actor._id,
				action: "user.clients_reassigned",
				entityType: "user",
				entityId: from._id,
				summary: `Moved ${moved} client${moved === 1 ? "" : "s"} from ${from.name} to ${to.name}`,
				after: { to: to._id, count: moved },
			},
			{ session },
		);
	});
	return { moved, from: publicUser(from), to: publicUser(to) };
};

module.exports = { listBrokers, createUser, setStatus, resetPassword, reassignClients, generatePassword };

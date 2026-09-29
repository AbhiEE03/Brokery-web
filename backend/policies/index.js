/**
 * Object-level authorization rules, one place for the whole API.
 *
 * can(user, action, resourceType, resource) → boolean
 *
 * Decisions (documented in README):
 * - Clients belong to their assigned broker; admins see everything.
 * - Property inventory is shared: every authenticated user can read it, but only
 *   the broker who added a property (or an admin) can change it.
 * - A match is visible to its creator, to the broker who owns the client, and to admins.
 */
const idOf = (value) => (value?._id ?? value)?.toString();
const sameId = (a, b) => Boolean(a) && Boolean(b) && idOf(a) === idOf(b);
const isAdmin = (user) => user?.role === "admin";

const ownsClient = (user, client) =>
	isAdmin(user) || sameId(client?.assignedBroker, user?._id);

const ownsProperty = (user, property) =>
	isAdmin(user) || sameId(property?.addedBy, user?._id);

const ownsMatch = (user, match) =>
	isAdmin(user) ||
	sameId(match?.createdBy, user?._id) ||
	sameId(match?.client?.assignedBroker, user?._id);

const rules = {
	client: {
		read: ownsClient,
		update: ownsClient,
		upload: ownsClient,
		link: ownsClient,
		delete: isAdmin,
	},
	property: {
		read: (user) => Boolean(user),
		update: ownsProperty,
		upload: ownsProperty,
		delete: isAdmin,
	},
	match: {
		read: ownsMatch,
		update: ownsMatch,
		delete: ownsMatch,
	},
	changeRequest: {
		read: (user, cr) => isAdmin(user) || sameId(cr?.requestedBy, user?._id),
		resolve: isAdmin,
	},
};

const can = (user, action, resourceType, resource) => {
	const rule = rules[resourceType]?.[action];
	if (!rule) {
		throw new Error(`No policy for ${resourceType}.${action}`);
	}
	return Boolean(user) && rule(user, resource);
};

module.exports = { can, isAdmin, sameId, idOf };

const Notification = require("../models/Notification");
const User = require("../models/User");
const emailService = require("../utils/emailService");

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 30 * 1000;

// Exponential backoff: 30s, 1m, 2m, 4m…
const nextAttemptAt = (attempts) =>
	new Date(Date.now() + BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));

const deliver = async (notification) => {
	if (notification.kind === "change_request_resolved") {
		const user = await User.findById(notification.user).select("name email").lean();
		if (!user?.email) return;
		const { entityType, status, adminNote, changes } = notification.payload;
		await emailService.sendChangeRequestResolved({
			toEmail: user.email,
			brokerName: user.name,
			entityType,
			action: status,
			adminNote,
			changes,
		});
	}
};

/**
 * Delivers due notifications. Each row is claimed with an atomic
 * queued→sending update, so concurrent dispatchers never send twice.
 * Returns the number of notifications processed.
 */
const dispatchPending = async ({ limit = 20 } = {}) => {
	let processed = 0;

	for (; processed < limit; processed += 1) {
		const notification = await Notification.findOneAndUpdate(
			{ status: "queued", nextAttemptAt: { $lte: new Date() } },
			{ $set: { status: "sending" }, $inc: { attempts: 1 } },
			{ new: true, sort: { nextAttemptAt: 1 } },
		);
		if (!notification) break;

		try {
			await deliver(notification);
			notification.status = "sent";
			notification.sentAt = new Date();
			notification.lastError = undefined;
		} catch (error) {
			notification.lastError = error.message;
			if (notification.attempts >= MAX_ATTEMPTS) {
				notification.status = "failed";
			} else {
				notification.status = "queued";
				notification.nextAttemptAt = nextAttemptAt(notification.attempts);
			}
		}
		await notification.save();
	}

	return processed;
};

// Best-effort immediate delivery after a commit; retries are handled by the worker.
const dispatchSoon = () => {
	if (process.env.NODE_ENV === "test") return;
	setImmediate(() => {
		dispatchPending().catch((error) => {
			console.error("Notification dispatch failed:", error.message);
		});
	});
};

module.exports = { dispatchPending, dispatchSoon, MAX_ATTEMPTS };

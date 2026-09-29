const logger = require("../config/logger");
const { dispatchPending, reclaimStuck } = require("../services/notificationService");

/**
 * In-process poller for the notification outbox. Runs in the API process
 * (a single Render instance); dispatchPending claims rows atomically, so
 * running more than one instance would still never double-send.
 */
const createOutboxWorker = ({ intervalMs = 15000 } = {}) => {
	let timer = null;
	let running = null;

	// Not async: callers during a run get the same in-flight promise.
	const tick = () => {
		if (running) return running; // never overlap runs
		running = (async () => {
			try {
				await reclaimStuck();
				const processed = await dispatchPending();
				if (processed) logger.info({ processed }, "Outbox dispatched");
			} catch (error) {
				logger.error({ err: error }, "Outbox tick failed");
			} finally {
				running = null;
			}
		})();
		return running;
	};

	return {
		start() {
			if (!timer) timer = setInterval(tick, intervalMs);
			return this;
		},
		async stop() {
			clearInterval(timer);
			timer = null;
			await running;
		},
		tick,
	};
};

module.exports = { createOutboxWorker };

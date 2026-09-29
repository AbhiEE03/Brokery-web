/**
 * Per-request context (request id, client IP) available anywhere in the call
 * chain without threading it through every function — the audit log uses it.
 */
const { AsyncLocalStorage } = require("async_hooks");

const storage = new AsyncLocalStorage();

const requestContext = (req, res, next) => {
	storage.run({ requestId: req.id, ip: req.ip }, next);
};

const getRequestContext = () => storage.getStore() || {};

module.exports = { requestContext, getRequestContext, runWithContext: (ctx, fn) => storage.run(ctx, fn) };

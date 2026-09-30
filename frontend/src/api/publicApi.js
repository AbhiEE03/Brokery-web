// Public (no login) endpoints for buyers. Plain fetch on purpose: no auth
// header, and a 401/404 here must never sign a broker out in the same browser.
const BASE = import.meta.env.VITE_API_URL;

const call = async (path, options = {}) => {
	const response = await fetch(`${BASE}${path}`, {
		...options,
		headers: { "Content-Type": "application/json", ...(options.headers || {}) },
	});
	const body = await response.json().catch(() => ({}));
	if (!response.ok) {
		const error = new Error(body.message || "Request failed");
		error.status = response.status;
		throw error;
	}
	return body;
};

export const getPublicShortlist = (token) => call(`/public/shortlists/${encodeURIComponent(token)}`);

export const sendShortlistFeedback = (token, payload) =>
	call(`/public/shortlists/${encodeURIComponent(token)}/feedback`, { method: "POST", body: JSON.stringify(payload) });

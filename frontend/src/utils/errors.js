// Server messages first; field-level validation reasons over the generic "Validation failed".
export const messageFrom = (error, fallback = "Something went wrong.") => {
	if (!error) return fallback;
	if (typeof error === "string") return error;
	const body = error.response?.data;
	return body?.details?.errors?.[0]?.message || body?.message || error.message || fallback;
};

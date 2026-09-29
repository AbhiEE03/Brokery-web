import { QueryClient } from "@tanstack/react-query";
import store from "../store/store";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 30_000,
			refetchOnWindowFocus: false,
			// Retry only transient server errors; 4xx answers won't change on retry.
			retry: (failureCount, error) => (error?.response?.status ?? 500) >= 500 && failureCount < 2,
		},
	},
});

// Never show one user's cached data to the next: drop the cache on any logout
// (the Sign out button or an expired session).
let lastToken = store.getState().auth.token;
store.subscribe(() => {
	const { token } = store.getState().auth;
	if (lastToken && !token) queryClient.clear();
	lastToken = token;
});

export default queryClient;

import axios from "axios";
import store from "../store/store";
import { logout } from "../store/authSlice";

const api = axios.create({
	baseURL: import.meta.env.VITE_API_URL,
});

api.interceptors.request.use((config) => {
	const token = store.getState().auth.token;

	if (token) {
		config.headers = config.headers || {};
		config.headers.Authorization = `Bearer ${token}`;
	}

	return config;
});

// An expired or revoked token (or a deactivated account) comes back as 401 on
// any request. Log out once; ProtectedRoute then sends the user to /login.
api.interceptors.response.use(
	(response) => response,
	(error) => {
		const isLoginRequest = error.config?.url?.includes("/auth/login");
		if (error.response?.status === 401 && !isLoginRequest && store.getState().auth.token) {
			store.dispatch(logout({ notice: "Your session has expired. Please sign in again." }));
		}
		return Promise.reject(error);
	},
);

export default api;

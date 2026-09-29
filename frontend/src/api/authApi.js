import api from "./axiosInstance";

// Returns { token, user } from the { success, data } envelope.
export const login = async (credentials) => {
	const { data } = await api.post("/auth/login", credentials);
	return data.data;
};

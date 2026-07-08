import api from "./axiosInstance";

export const getMatches = async (params = {}) => {
	const { data } = await api.get("/matches", { params });
	return data;
};

export const createMatch = async (payload) => {
	const { data } = await api.post("/matches", payload);
	return data;
};

export const updateMatch = async (id, payload) => {
	const { data } = await api.patch(`/matches/${id}`, payload);
	return data;
};

export const deleteMatch = async (id) => {
	const { data } = await api.delete(`/matches/${id}`);
	return data;
};
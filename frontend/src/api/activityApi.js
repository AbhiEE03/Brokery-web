import api from "./axiosInstance";

export const getActivityLogs = async (params = {}) => {
	const { data } = await api.get("/activity", { params });
	return data;
};
import api from "./axiosInstance";

export const getChangeRequests = async (params = {}) => {
	const { data } = await api.get("/change-requests", { params });
	return data;
};

export const approveChangeRequest = async (id, adminNote) => {
	const { data } = await api.post(`/change-requests/${id}/approve`, { adminNote });
	return data;
};

export const rejectChangeRequest = async (id, adminNote) => {
	const { data } = await api.post(`/change-requests/${id}/reject`, { adminNote });
	return data;
};

export const withdrawChangeRequest = async (id) => {
	const { data } = await api.post(`/change-requests/${id}/withdraw`);
	return data;
};

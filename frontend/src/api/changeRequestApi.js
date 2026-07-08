import api from "./axiosInstance";

export const getChangeRequests = async (params = {}) => {
	const { data } = await api.get("/change-requests", { params });
	return data;
};

export const resolveChangeRequest = async (id, action, rejectionReason) => {
	const { data } = await api.patch(`/change-requests/${id}/resolve`, {
		action,
		adminNote: rejectionReason,
	});
	return data;
};

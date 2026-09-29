import api from "./axiosInstance";

export const getOwnershipClaims = async (params = {}) => {
	const { data } = await api.get("/ownership-claims", { params });
	return data;
};

export const resolveOwnershipClaim = async (id, decision, note) => {
	const { data } = await api.post(`/ownership-claims/${id}/resolve`, { decision, note });
	return data;
};

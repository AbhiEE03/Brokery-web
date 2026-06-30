import api from "./axiosInstance";

export const getProperties = async (params = {}) => {
	const { data } = await api.get("/properties", { params });
	return data;
};

export const getPropertyById = async (id) => {
	const { data } = await api.get(`/properties/${id}`);
	return data;
};

export const createProperty = async (payload) => {
	const { data } = await api.post("/properties", payload);
	return data;
};

export const updateProperty = async (id, payload) => {
	const { data } = await api.patch(`/properties/${id}`, payload);
	return data;
};

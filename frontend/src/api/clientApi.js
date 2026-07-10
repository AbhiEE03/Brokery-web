import api from "./axiosInstance";

export const getClients = async (params = {}) => {
	const { data } = await api.get("/clients", { params });
	return data;
};

export const getClientById = async (id) => {
	const { data } = await api.get(`/clients/${id}`);
	return data;
};

export const createClient = async (payload) => {
	const { data } = await api.post("/clients", payload);
	return data;
};

export const updateClient = async (id, payload) => {
	const { data } = await api.patch(`/clients/${id}`, payload);
	return data;
};

export const uploadClientDocument = async (clientId, formData) => {
	const { data } = await api.post(`/clients/${clientId}/documents`, formData, {
		headers: {
			"Content-Type": "multipart/form-data",
		},
	});
	return data;
};

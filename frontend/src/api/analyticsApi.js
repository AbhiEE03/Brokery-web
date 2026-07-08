import api from "./axiosInstance";

export const getSummary = async () => {
	const { data } = await api.get("/analytics/summary");
	return data;
};

export const getDealsByMonth = async () => {
	const { data } = await api.get("/analytics/deals-by-month");
	return data;
};

export const getPipelineDistribution = async () => {
	const { data } = await api.get("/analytics/pipeline-distribution");
	return data;
};

export const getBrokerPerformance = async () => {
	const { data } = await api.get("/analytics/broker-performance");
	return data;
};

export const getPropertyByCity = async () => {
	const { data } = await api.get("/analytics/property-by-city");
	return data;
};

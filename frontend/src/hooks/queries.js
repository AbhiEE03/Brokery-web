// Server state per resource. Pages call these hooks instead of keeping their own
// loading / error / refresh state; mutations invalidate what they change.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../api/axiosInstance";
import {
	approveChangeRequest,
	getChangeRequests,
	rejectChangeRequest,
	withdrawChangeRequest,
} from "../api/changeRequestApi";
import { getOwnershipClaims, resolveOwnershipClaim } from "../api/ownershipApi";
import { getProperties } from "../api/propertyApi";

const clean = (params) => Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ""));

export const useChangeRequests = (params) =>
	useQuery({
		queryKey: ["changeRequests", clean(params)],
		queryFn: () => getChangeRequests(clean(params)),
		placeholderData: keepPreviousData,
	});

export const useChangeRequestDecision = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, action, note }) => {
			if (action === "approve") return approveChangeRequest(id, note);
			if (action === "reject") return rejectChangeRequest(id, note);
			return withdrawChangeRequest(id);
		},
		onSettled: () => {
			queryClient.invalidateQueries({ queryKey: ["changeRequests"] });
			queryClient.invalidateQueries({ queryKey: ["history"] });
		},
	});
};

export const useProperties = (params) =>
	useQuery({
		queryKey: ["properties", clean(params)],
		queryFn: () => getProperties(clean(params)),
		placeholderData: keepPreviousData,
	});

export const useOwnershipClaims = (params) =>
	useQuery({
		queryKey: ["ownershipClaims", clean(params)],
		queryFn: () => getOwnershipClaims(clean(params)),
		placeholderData: keepPreviousData,
	});

export const useResolveOwnershipClaim = () => {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ id, decision, note }) => resolveOwnershipClaim(id, decision, note),
		onSettled: () => queryClient.invalidateQueries({ queryKey: ["ownershipClaims"] }),
	});
};

export const useRecordHistory = (entityId, { limit = 10 } = {}) =>
	useQuery({
		queryKey: ["history", entityId, limit],
		queryFn: async () => (await api.get(`/activity/entity/${entityId}`, { params: { limit } })).data,
		enabled: Boolean(entityId),
	});

export const useEditPolicies = () =>
	useQuery({
		queryKey: ["editPolicies"],
		queryFn: async () => (await api.get("/meta/edit-policies")).data.data,
		staleTime: Infinity,
	});

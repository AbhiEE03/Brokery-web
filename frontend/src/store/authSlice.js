import { createSlice } from "@reduxjs/toolkit";

const loadPersistedAuth = () => {
	try {
		return {
			user: JSON.parse(localStorage.getItem("brokery_user")),
			token: localStorage.getItem("brokery_token"),
		};
	} catch {
		return { user: null, token: null };
	}
};

const initialAuth = loadPersistedAuth();

const authSlice = createSlice({
	name: "auth",
	initialState: {
		user: initialAuth.user,
		token: initialAuth.token,
		// Shown on the login page after an automatic logout (e.g. expired session).
		notice: null,
	},
	reducers: {
		setCredentials: (state, action) => {
			const { user, token } = action.payload;
			state.user = user;
			state.token = token;
			state.notice = null;
			localStorage.setItem("brokery_user", JSON.stringify(user));
			localStorage.setItem("brokery_token", token);
		},
		logout: (state, action) => {
			state.user = null;
			state.token = null;
			state.notice = action?.payload?.notice ?? null;
			localStorage.removeItem("brokery_user");
			localStorage.removeItem("brokery_token");
		},
	},
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;

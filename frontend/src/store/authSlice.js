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
	},
	reducers: {
		setCredentials: (state, action) => {
			const { user, token } = action.payload;
			state.user = user;
			state.token = token;
			localStorage.setItem("brokery_user", JSON.stringify(user));
			localStorage.setItem("brokery_token", token);
		},
		logout: (state) => {
			state.user = null;
			state.token = null;
			localStorage.removeItem("brokery_user");
			localStorage.removeItem("brokery_token");
		},
	},
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;

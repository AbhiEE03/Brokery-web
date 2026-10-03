import { StrictMode } from "react";
import { Provider } from "react-redux";
import { QueryClientProvider } from "@tanstack/react-query";
import App from "./App.jsx";
import store from "./store/store";
import ThemeProvider from "./theme/ThemeProvider";
import ToastProvider from "./components/ui/ToastProvider";
import queryClient from "./api/queryClient";

/**
 * The app's provider tree, shared by the browser entry (main.jsx) and the
 * build-time pre-renderer (entry-prerender.jsx). Both must render the exact
 * same tree, or hydration of the pre-rendered landing page would mismatch.
 */
const Root = ({ Router, routerProps }) => (
	<StrictMode>
		<Router {...routerProps}>
			<Provider store={store}>
				<QueryClientProvider client={queryClient}>
					<ThemeProvider>
						<ToastProvider>
							<App />
						</ToastProvider>
					</ThemeProvider>
				</QueryClientProvider>
			</Provider>
		</Router>
	</StrictMode>
);

export default Root;

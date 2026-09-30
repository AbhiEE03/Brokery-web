import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import store from "./store/store";
import ThemeProvider from "./theme/ThemeProvider";
import ToastProvider from "./components/ui/ToastProvider";
import queryClient from "./api/queryClient";

createRoot(document.getElementById("root")).render(
	<StrictMode>
		<BrowserRouter>
			<Provider store={store}>
				<QueryClientProvider client={queryClient}>
					<ThemeProvider>
						<ToastProvider>
							<App />
						</ToastProvider>
					</ThemeProvider>
				</QueryClientProvider>
			</Provider>
		</BrowserRouter>
	</StrictMode>,
);

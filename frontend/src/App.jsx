import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import Sidebar from "./components/layout/Sidebar";
import Login from "./pages/Login";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Properties from "./pages/Properties";
import PropertyDetail from "./pages/PropertyDetail";
import Dashboard from "./pages/Dashboard";
import ActivityLog from "./pages/ActivityLog";
import ChangeRequests from "./pages/ChangeRequests";
import Matches from "./pages/Matches";

const PageShell = ({ title, description }) => (
	<section className="flex min-h-[calc(100vh-3rem)] items-center justify-center p-6 sm:p-8">
		<div className="w-full max-w-4xl rounded-[2rem] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-8 shadow-sm sm:p-10">
			<p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
				Brokery CRM
			</p>
			<h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
				{title}
			</h2>
			<p className="mt-3 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
				{description}
			</p>
		</div>
	</section>
);

function App() {
	return (
		<Routes>
			<Route path="/login" element={<Login />} />

			<Route element={<ProtectedRoute />}>
				<Route element={<Sidebar />}>
					<Route index element={<Navigate to="/dashboard" replace />} />
					<Route path="/dashboard" element={<Dashboard />} />
					<Route path="/clients" element={<Clients />} />
					<Route path="/clients/:id" element={<ClientDetail />} />
					<Route path="/properties" element={<Properties />} />
					<Route path="/properties/:id" element={<PropertyDetail />} />
					<Route
						path="/matches"
						element={<Matches />}
					/>
					<Route path="/change-requests" element={<ChangeRequests />} />
					<Route path="/activity-log" element={<ActivityLog />} />
				</Route>
			</Route>

			<Route path="*" element={<Navigate to="/dashboard" replace />} />
		</Routes>
	);
}

export default App;

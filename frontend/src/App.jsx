import { Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import RequireRole from "./components/layout/RequireRole";
import HomeRedirect from "./components/layout/HomeRedirect";
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
import OwnershipClaims from "./pages/OwnershipClaims";
import PublicShortlist from "./pages/PublicShortlist";
import Team from "./pages/Team";

function App() {
	return (
		<Routes>
			<Route path="/login" element={<Login />} />
			{/* Public: a buyer opens a shortlist link without an account. */}
			<Route path="/s/:token" element={<PublicShortlist />} />

			<Route element={<ProtectedRoute />}>
				<Route element={<Sidebar />}>
					<Route index element={<HomeRedirect />} />
					<Route path="/clients" element={<Clients />} />
					<Route path="/clients/:id" element={<ClientDetail />} />
					<Route path="/properties" element={<Properties />} />
					<Route path="/properties/:id" element={<PropertyDetail />} />
					<Route path="/matches" element={<Matches />} />
					<Route path="/change-requests" element={<ChangeRequests />} />

					<Route element={<RequireRole roles={["admin"]} />}>
						<Route path="/dashboard" element={<Dashboard />} />
						<Route path="/activity-log" element={<ActivityLog />} />
						<Route path="/ownership-claims" element={<OwnershipClaims />} />
						<Route path="/team" element={<Team />} />
					</Route>
				</Route>
			</Route>

			<Route path="*" element={<HomeRedirect />} />
		</Routes>
	);
}

export default App;

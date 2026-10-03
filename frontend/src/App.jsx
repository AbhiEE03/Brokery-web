import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import RequireRole from "./components/layout/RequireRole";
import HomeRedirect from "./components/layout/HomeRedirect";
import PublicHome from "./components/layout/PublicHome";

// Code-splitting: only the landing page and the route guards are in the main
// bundle. Every other screen is its own chunk, downloaded when first opened, so
// visitors to "/" don't download the dashboard charts, the app shell and so on.
const Sidebar = lazy(() => import("./components/layout/Sidebar"));
const Login = lazy(() => import("./pages/Login"));
const Clients = lazy(() => import("./pages/Clients"));
const ClientDetail = lazy(() => import("./pages/ClientDetail"));
const Properties = lazy(() => import("./pages/Properties"));
const PropertyDetail = lazy(() => import("./pages/PropertyDetail"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const ActivityLog = lazy(() => import("./pages/ActivityLog"));
const ChangeRequests = lazy(() => import("./pages/ChangeRequests"));
const Matches = lazy(() => import("./pages/Matches"));
const OwnershipClaims = lazy(() => import("./pages/OwnershipClaims"));
const PublicShortlist = lazy(() => import("./pages/PublicShortlist"));
const Team = lazy(() => import("./pages/Team"));

const PageLoading = () => (
	<p role="status" className="p-8 text-sm text-slate-500">
		Loading…
	</p>
);

function App() {
	return (
		<Suspense fallback={<PageLoading />}>
			<Routes>
				{/* Public landing page for visitors (pre-rendered for search engines). */}
				<Route path="/" element={<PublicHome />} />
				<Route path="/login" element={<Login />} />
				{/* Public: a buyer opens a shortlist link without an account. */}
				<Route path="/s/:token" element={<PublicShortlist />} />

				<Route element={<ProtectedRoute />}>
					<Route element={<Sidebar />}>
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
		</Suspense>
	);
}

export default App;

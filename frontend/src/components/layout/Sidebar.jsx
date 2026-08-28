import {
	Building2,
	LayoutDashboard,
	ListChecks,
	LogOut,
	Moon,
	Sun,
	Users,
	WalletCards,
	GitBranch,
	History,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../../store/authSlice";
import useTheme from "../../hooks/useTheme";

const navItemBase =
	"flex items-center gap-3 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200";

const navItemClassName = ({ isActive }) =>
	`${navItemBase} ${
		isActive
			? "bg-slate-900 text-white shadow-lg shadow-slate-900/20 dark:bg-slate-700"
			: "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
	}`;

const Sidebar = () => {
	const dispatch = useDispatch();
	const user = useSelector((state) => state.auth.user);
	const isAdmin = user?.role === "admin";
	const { theme, toggleTheme } = useTheme();

	const initial = (user?.name || "?").trim().charAt(0).toUpperCase();

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc,_#e2e8f0_55%,_#cbd5e1)] text-slate-950 dark:bg-slate-950 dark:text-slate-100">
			<div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 p-4 lg:p-6">
				<aside className="flex w-full flex-col rounded-3xl border border-white/70 bg-white/80 p-4 shadow-2xl shadow-slate-200/60 backdrop-blur dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/60 xl:w-80 xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)]">
					{/* Brand header */}
					<div className="flex items-center gap-3 rounded-2xl bg-slate-950 px-4 py-4 text-white shadow-lg shadow-slate-950/25 dark:bg-slate-800">
						<div className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-400 text-slate-950">
							<Building2 size={22} />
						</div>
						<div>
							<p className="text-xs uppercase tracking-[0.28em] text-slate-300">
								Brokery
							</p>
							<h1 className="text-lg font-semibold">Real Estate CRM</h1>
						</div>
					</div>

					{/* User avatar block */}
					<div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
						<div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
							{initial}
						</div>
						<div className="min-w-0">
							<p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
								{user?.name || "Guest User"}
							</p>
							<p className="truncate text-xs text-slate-400 dark:text-slate-500">
								{user?.role || "No role"}
							</p>
						</div>
					</div>

					{/* Nav */}
					<nav className="mt-5 flex-1 space-y-1">
						{isAdmin ? (
							<NavLink to="/dashboard" className={navItemClassName}>
								<LayoutDashboard size={18} />
								Dashboard
							</NavLink>
						) : null}
						<NavLink to="/clients" className={navItemClassName}>
							<Users size={18} />
							Clients
						</NavLink>
						<NavLink to="/properties" className={navItemClassName}>
							<WalletCards size={18} />
							Properties
						</NavLink>
						<NavLink to="/matches" className={navItemClassName}>
							<GitBranch size={18} />
							Matches
						</NavLink>
						<NavLink to="/change-requests" className={navItemClassName}>
							<ListChecks size={18} />
							Change Requests
						</NavLink>
						{isAdmin ? (
							<NavLink to="/activity-log" className={navItemClassName}>
								<History size={18} />
								Activity Log
							</NavLink>
						) : null}
					</nav>

					{/* Bottom actions */}
					<div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
						<button
							type="button"
							onClick={toggleTheme}
							className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
						>
							{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
							{theme === "dark" ? "Light mode" : "Dark mode"}
						</button>

						<button
							type="button"
							onClick={() => dispatch(logout())}
							className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
						>
							<LogOut size={18} />
							Sign out
						</button>
					</div>
				</aside>

				<main className="min-w-0 flex-1 overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-2xl shadow-slate-200/60 backdrop-blur dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/60">
					<Outlet />
				</main>
			</div>
		</div>
	);
};

export default Sidebar;

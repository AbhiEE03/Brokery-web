import { useEffect, useState } from "react";
import {
	LayoutDashboard,
	ListChecks,
	LogOut,
	Menu,
	Moon,
	Sun,
	Users,
	WalletCards,
	GitBranch,
	History,
	ShieldAlert,
	Search,
	UsersRound,
	X,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../../store/authSlice";
import useTheme from "../../hooks/useTheme";
import AlertsBell from "./AlertsBell";
import CommandPalette from "./CommandPalette";

const navItemBase =
	"flex items-center gap-3 rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200";

const navItemClassName = ({ isActive }) =>
	`${navItemBase} ${
		isActive ?
			"bg-slate-900 text-white shadow-lg shadow-slate-900/20 dark:bg-slate-700"
		:	"text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
	}`;

/** The skyline logo, shared by the drawer header and the mobile top bar. */
const BrandMark = ({ size = 32 }) => (
	<svg
		width={size}
		height={size}
		viewBox="0 0 32 32"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
		aria-hidden="true"
		className="shrink-0"
	>
		{/* Left short block */}
		<rect x="2" y="18" width="7" height="12" rx="1" fill="#10b981" />
		{/* Left block windows */}
		<rect x="3.5" y="20" width="1.5" height="1.5" rx="0.3" fill="#064e3b" />
		<rect x="6" y="20" width="1.5" height="1.5" rx="0.3" fill="#064e3b" />
		<rect x="3.5" y="23" width="1.5" height="1.5" rx="0.3" fill="#064e3b" />
		<rect x="6" y="23" width="1.5" height="1.5" rx="0.3" fill="#064e3b" />
		{/* Center tall block */}
		<rect x="11" y="8" width="10" height="22" rx="1" fill="#10b981" />
		{/* Center block windows */}
		<rect x="13" y="11" width="2" height="2" rx="0.3" fill="#064e3b" />
		<rect x="17" y="11" width="2" height="2" rx="0.3" fill="#064e3b" />
		<rect x="13" y="15" width="2" height="2" rx="0.3" fill="#064e3b" />
		<rect x="17" y="15" width="2" height="2" rx="0.3" fill="#064e3b" />
		<rect x="13" y="19" width="2" height="2" rx="0.3" fill="#064e3b" />
		<rect x="17" y="19" width="2" height="2" rx="0.3" fill="#064e3b" />
		{/* Right medium block */}
		<rect x="23" y="13" width="7" height="17" rx="1" fill="#10b981" />
		{/* Right block windows */}
		<rect x="24.5" y="15" width="1.5" height="1.5" rx="0.3" fill="#064e3b" />
		<rect x="27" y="15" width="1.5" height="1.5" rx="0.3" fill="#064e3b" />
		<rect x="24.5" y="18.5" width="1.5" height="1.5" rx="0.3" fill="#064e3b" />
		<rect x="27" y="18.5" width="1.5" height="1.5" rx="0.3" fill="#064e3b" />
		{/* Ground line */}
		<rect
			x="1"
			y="30"
			width="30"
			height="1.5"
			rx="0.75"
			fill="#10b981"
			opacity="0.5"
		/>
	</svg>
);

/**
 * The app shell. From `xl` up, the sidebar is a sticky column beside the page.
 * Below that there is no room for both, so the sidebar becomes an off-canvas
 * drawer opened from a top bar. The drawer is `fixed`, so it leaves the flex
 * row entirely and the main panel gets the full width on phones and tablets.
 */
const Sidebar = () => {
	const dispatch = useDispatch();
	const user = useSelector((state) => state.auth.user);
	const isAdmin = user?.role === "admin";
	const { theme, toggleTheme } = useTheme();
	const [paletteOpen, setPaletteOpen] = useState(false);
	const [drawerOpen, setDrawerOpen] = useState(false);
	const { pathname } = useLocation();

	// Ctrl/Cmd+K opens search from anywhere.
	useEffect(() => {
		const onKey = (event) => {
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setPaletteOpen((open) => !open);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, []);

	// Navigating is what the drawer is for: close it once the route changes.
	useEffect(() => setDrawerOpen(false), [pathname]);

	// While the drawer covers the page, Escape closes it and the page behind
	// it must not scroll.
	useEffect(() => {
		if (!drawerOpen) return undefined;
		const onKey = (event) => {
			if (event.key === "Escape") setDrawerOpen(false);
		};
		document.addEventListener("keydown", onKey);
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = previousOverflow;
		};
	}, [drawerOpen]);

	const initial = (user?.name || "?").trim().charAt(0).toUpperCase();

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc,_#e2e8f0_55%,_#cbd5e1)] text-slate-950 dark:bg-slate-950 dark:text-slate-100">
			{/* Top bar: only below xl, where the sidebar is a drawer. */}
			<header className="sticky top-0 z-30 flex items-center gap-2 border-b border-white/70 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 xl:hidden">
				<button
					type="button"
					onClick={() => setDrawerOpen(true)}
					aria-label="Open navigation menu"
					aria-expanded={drawerOpen}
					aria-controls="app-sidebar"
					className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
				>
					<Menu size={20} />
				</button>
				<span className="flex items-center gap-2">
					<BrandMark size={24} />
					<span className="text-base font-semibold text-slate-900 dark:text-white">
						Brokery
					</span>
				</span>
				<div className="ml-auto flex items-center gap-1">
					<button
						type="button"
						onClick={() => setPaletteOpen(true)}
						aria-label="Search"
						className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
					>
						<Search size={18} />
					</button>
					<AlertsBell />
				</div>
			</header>

			{/* Backdrop behind the open drawer. */}
			{drawerOpen ?
				<div
					aria-hidden="true"
					onClick={() => setDrawerOpen(false)}
					className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm xl:hidden"
				/>
			:	null}

			<div className="mx-auto flex min-h-screen max-w-[1600px] gap-6 p-4 lg:p-6">
				<aside
					id="app-sidebar"
					aria-label="Main navigation"
					className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto rounded-r-3xl border border-white/70 bg-white p-4 shadow-2xl transition-transform duration-300 ease-out dark:border-slate-800 dark:bg-slate-900 xl:sticky xl:bottom-auto xl:top-6 xl:z-30 xl:h-[calc(100vh-3rem)] xl:w-80 xl:max-w-none xl:translate-x-0 xl:rounded-3xl xl:bg-white/80 xl:shadow-slate-200/60 xl:backdrop-blur dark:xl:shadow-slate-950/60 ${
						drawerOpen ? "translate-x-0"
						:	"invisible -translate-x-full xl:visible"
					}`}
				>
					{/* Brand header */}
					<div className="flex items-center gap-3 rounded-2xl bg-slate-950 px-4 py-4 text-white shadow-lg shadow-slate-950/25 dark:bg-slate-800">
						<BrandMark />
						<div>
							<p className="text-lg font-semibold text-white leading-none">
								Brokery
							</p>
							<p className="text-xs text-emerald-400 tracking-widest uppercase mt-0.5">
								CRM
							</p>
						</div>
						{/* Closing is only possible, and only needed, below xl. */}
						<button
							type="button"
							onClick={() => setDrawerOpen(false)}
							aria-label="Close navigation menu"
							className="ml-auto grid h-9 w-9 place-items-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white xl:hidden"
						>
							<X size={18} />
						</button>
					</div>

					{/* User avatar block */}
					<div className="mt-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800">
						<div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
							{initial}
						</div>
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
								{user?.name || "Guest User"}
							</p>
							<p className="truncate text-xs text-slate-400 dark:text-slate-500">
								{user?.role || "No role"}
							</p>
						</div>
						{/* Below xl the bell sits in the top bar instead. */}
						<div className="hidden xl:block">
							<AlertsBell />
						</div>
					</div>

					<button
						type="button"
						onClick={() => setPaletteOpen(true)}
						className="mt-4 flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-400 transition hover:border-slate-300 hover:text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:hover:text-slate-300"
					>
						<Search size={16} />
						<span className="flex-1 text-left">Search…</span>
						<kbd className="hidden rounded-md border border-slate-200 px-1.5 text-[10px] font-semibold dark:border-slate-600 xl:inline">
							Ctrl K
						</kbd>
					</button>
					<CommandPalette
						open={paletteOpen}
						onClose={() => setPaletteOpen(false)}
					/>

					{/* Nav */}
					<nav className="mt-5 flex-1 space-y-1">
						{isAdmin ?
							<NavLink to="/dashboard" className={navItemClassName}>
								<LayoutDashboard size={18} />
								Dashboard
							</NavLink>
						:	null}
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
						{isAdmin ?
							<NavLink to="/team" className={navItemClassName}>
								<UsersRound size={18} />
								Team
							</NavLink>
						:	null}
						{isAdmin ?
							<NavLink to="/ownership-claims" className={navItemClassName}>
								<ShieldAlert size={18} />
								Ownership Claims
							</NavLink>
						:	null}
						{isAdmin ?
							<NavLink to="/activity-log" className={navItemClassName}>
								<History size={18} />
								Activity Log
							</NavLink>
						:	null}
					</nav>

					{/* Bottom actions */}
					<div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
						<button
							type="button"
							onClick={toggleTheme}
							className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
						>
							{theme === "dark" ?
								<Sun size={18} />
							:	<Moon size={18} />}
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

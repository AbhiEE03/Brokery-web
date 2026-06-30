import { useState } from "react";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Building2, LockKeyhole, Mail } from "lucide-react";
import { login } from "../api/authApi";
import { setCredentials } from "../store/authSlice";

const Login = () => {
	const dispatch = useDispatch();
	const navigate = useNavigate();
	const [formData, setFormData] = useState({ email: "", password: "" });
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	const handleChange = (event) => {
		const { name, value } = event.target;
		setFormData((current) => ({ ...current, [name]: value }));
	};

	const handleSubmit = async (event) => {
		event.preventDefault();
		setError("");
		setLoading(true);

		try {
			const data = await login(formData);
			dispatch(setCredentials({ user: data.user, token: data.token }));
			navigate("/dashboard", { replace: true });
		} catch (err) {
			setError(
				err.response?.data?.message || "Unable to sign in. Please try again.",
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-[radial-gradient(circle_at_top,_#0f172a,_#111827_42%,_#1f2937_100%)] px-4 py-8 text-white sm:px-6 lg:px-8">
			<div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
				<section className="rounded-[2rem] border border-white/10 bg-white/5 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-10">
					<div className="inline-flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-emerald-200">
						<Building2 size={20} />
						<span className="text-sm font-semibold uppercase tracking-[0.24em]">
							Brokery CRM
						</span>
					</div>

					<h1 className="mt-8 max-w-xl text-4xl font-semibold tracking-tight sm:text-5xl">
						Brokerage operations, organized for speed and control.
					</h1>
					<p className="mt-4 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
						Sign in to manage clients, properties, approvals, and activity from
						one secure dashboard.
					</p>

					<div className="mt-10 grid gap-4 sm:grid-cols-3">
						{[
							["RBAC", "Role-aware access for admin and broker workflows"],
							["Approvals", "Sensitive edits move through change requests"],
							["Analytics", "Track pipeline and performance in real time"],
						].map(([title, description]) => (
							<div
								key={title}
								className="rounded-2xl border border-white/10 bg-white/5 p-4"
							>
								<p className="text-sm font-semibold text-white">{title}</p>
								<p className="mt-2 text-sm leading-6 text-slate-300">
									{description}
								</p>
							</div>
						))}
					</div>
				</section>

				<section className="rounded-[2rem] border border-white/10 bg-slate-950/90 p-6 shadow-2xl shadow-black/30 sm:p-8">
					<div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
						<div className="flex items-center gap-3">
							<div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400 text-slate-950">
								<LockKeyhole size={22} />
							</div>
							<div>
								<p className="text-sm uppercase tracking-[0.24em] text-slate-400">
									Welcome back
								</p>
								<h2 className="text-2xl font-semibold text-white">
									Sign in to continue
								</h2>
							</div>
						</div>

						<form className="mt-8 space-y-5" onSubmit={handleSubmit}>
							<label className="block">
								<span className="mb-2 block text-sm font-medium text-slate-300">
									Email
								</span>
								<div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 focus-within:border-emerald-400/70">
									<Mail size={18} className="shrink-0 text-slate-400" />
									<input
										type="email"
										name="email"
										value={formData.email}
										onChange={handleChange}
										placeholder="admin@brokery.com"
										className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
										required
									/>
								</div>
							</label>

							<label className="block">
								<span className="mb-2 block text-sm font-medium text-slate-300">
									Password
								</span>
								<div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 focus-within:border-emerald-400/70">
									<LockKeyhole size={18} className="shrink-0 text-slate-400" />
									<input
										type="password"
										name="password"
										value={formData.password}
										onChange={handleChange}
										placeholder="Enter your password"
										className="w-full bg-transparent text-white outline-none placeholder:text-slate-500"
										required
									/>
								</div>
							</label>

							{error ?
								<div className="rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
									{error}
								</div>
							:	null}

							<button
								type="submit"
								disabled={loading}
								className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
							>
								{loading ? "Signing in..." : "Sign in"}
								<ArrowRight size={18} />
							</button>
						</form>
					</div>
				</section>
			</div>
		</div>
	);
};

export default Login;

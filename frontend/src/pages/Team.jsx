import { useState } from "react";
import { useSelector } from "react-redux";
import { ArrowRightLeft, Copy, KeyRound, Power, UserPlus, X } from "lucide-react";
import { useTeam, useTeamMutations } from "../hooks/queries";
import useConfirmDialog from "../hooks/useConfirmDialog";
import useToast from "../hooks/useToast";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import ReassignDialog from "../components/team/ReassignDialog";
import { messageFrom } from "../utils/errors";
import { formatDate } from "../utils/format";

const input =
	"w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-950 outline-none focus:border-slate-400 dark:border-slate-700 dark:bg-slate-700 dark:text-white";

// A password shown exactly once (new account or reset), with copy.
const SecretPanel = ({ secret, onDismiss }) => {
	const toast = useToast();
	const copy = async () => {
		try {
			await navigator.clipboard.writeText(secret.password);
			toast.success("Password copied");
		} catch {
			toast.error("Couldn't copy", { description: "Select the password and copy it manually." });
		}
	};
	return (
		<div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
			<div className="flex items-start justify-between gap-3">
				<div>
					<p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">{secret.title}</p>
					<p className="mt-0.5 text-xs text-emerald-800/80 dark:text-emerald-300/80">
						Share it with {secret.name} privately. It won't be shown again; they should change it after signing in.
					</p>
				</div>
				<button type="button" aria-label="Dismiss" onClick={onDismiss} className="text-emerald-700 hover:text-emerald-900 dark:text-emerald-300">
					<X size={16} />
				</button>
			</div>
			<div className="mt-3 flex flex-wrap items-center gap-2">
				<code className="rounded-lg bg-white px-3 py-2 font-mono text-sm tracking-wide text-slate-900 ring-1 ring-emerald-200 dark:bg-slate-900 dark:text-white dark:ring-emerald-800">
					{secret.password}
				</code>
				<button
					type="button"
					onClick={copy}
					className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
				>
					<Copy size={14} /> Copy
				</button>
			</div>
		</div>
	);
};

const AddBrokerForm = ({ onSubmit, onCancel, busy }) => {
	const [form, setForm] = useState({ name: "", email: "", password: "", role: "broker" });
	const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				onSubmit({ ...form, password: form.password || undefined }, () => setForm({ name: "", email: "", password: "", role: "broker" }));
			}}
			className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800"
		>
			<h2 className="text-lg font-semibold text-slate-900 dark:text-white">Add a team member</h2>
			<div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<label className="block">
					<span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Name</span>
					<input className={input} value={form.name} onChange={set("name")} required />
				</label>
				<label className="block">
					<span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Email</span>
					<input className={input} type="email" value={form.email} onChange={set("email")} required />
				</label>
				<label className="block">
					<span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">
						Password <span className="text-xs font-normal text-slate-400">blank = generate</span>
					</span>
					<input className={input} type="text" minLength={10} value={form.password} onChange={set("password")} autoComplete="new-password" />
				</label>
				<label className="block">
					<span className="mb-1.5 block text-sm font-medium text-slate-600 dark:text-slate-300">Role</span>
					<select className={input} value={form.role} onChange={set("role")}>
						<option value="broker">Broker</option>
						<option value="admin">Admin</option>
					</select>
				</label>
			</div>
			<div className="mt-5 flex justify-end gap-3">
				<button type="button" onClick={onCancel} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-300">
					Cancel
				</button>
				<button type="submit" disabled={busy} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60 dark:bg-white dark:text-slate-950">
					{busy ? "Adding..." : "Add"}
				</button>
			</div>
		</form>
	);
};

const actionButton =
	"inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-40";

const Team = () => {
	const me = useSelector((state) => state.auth.user);
	const toast = useToast();
	const { confirm, dialog } = useConfirmDialog();
	const [showInactive, setShowInactive] = useState(false);
	const [formOpen, setFormOpen] = useState(false);
	const [secret, setSecret] = useState(null);
	const [reassign, setReassign] = useState(null); // { broker, mode: "move" | "offboard" }

	const query = useTeam(showInactive);
	const { create, setStatus, resetPassword, reassignClients } = useTeamMutations();
	const brokers = query.data || [];
	const busy = create.isPending || setStatus.isPending || resetPassword.isPending || reassignClients.isPending;
	const fail = (title) => (error) => toast.error(title, { description: messageFrom(error) });

	const add = (payload, reset) =>
		create.mutate(payload, {
			onSuccess: (response) => {
				reset();
				setFormOpen(false);
				const { user, generatedPassword } = response.data;
				toast.success(`${user.name} added`, user.role === "admin" ? { description: "Admins aren't listed here; they can sign in right away." } : undefined);
				if (generatedPassword) setSecret({ title: `Password for ${user.name} (${user.email})`, name: user.name, password: generatedPassword });
			},
			onError: fail("Couldn't add the account"),
		});

	const deactivate = (broker) =>
		setStatus.mutate(
			{ id: broker._id, isActive: false },
			{ onSuccess: () => toast.success(`${broker.name} deactivated`, { description: "Signed out immediately." }), onError: fail("Couldn't deactivate") },
		);

	const onDeactivate = async (broker) => {
		if (broker.clientCount > 0) {
			setReassign({ broker, mode: "offboard" });
			return;
		}
		const ok = await confirm({
			title: `Deactivate ${broker.name}?`,
			message: "They're signed out at once and can't sign in again until reactivated.",
			confirmLabel: "Deactivate",
			tone: "danger",
		});
		if (ok) deactivate(broker);
	};

	const onReactivate = (broker) =>
		setStatus.mutate({ id: broker._id, isActive: true }, { onSuccess: () => toast.success(`${broker.name} reactivated`), onError: fail("Couldn't reactivate") });

	const onReset = async (broker) => {
		const ok = await confirm({
			title: `Reset ${broker.name}'s password?`,
			message: "A new temporary password is generated and every device they're signed in on is signed out.",
			confirmLabel: "Reset password",
			tone: "danger",
		});
		if (!ok) return;
		resetPassword.mutate(broker._id, {
			onSuccess: (response) =>
				setSecret({ title: `New password for ${broker.name} (${broker.email})`, name: broker.name, password: response.data.temporaryPassword }),
			onError: fail("Couldn't reset the password"),
		});
	};

	const onReassignConfirm = (toBrokerId) => {
		const { broker, mode } = reassign;
		reassignClients.mutate(
			{ id: broker._id, toBrokerId },
			{
				onSuccess: (response) => {
					toast.success(response.message);
					setReassign(null);
					if (mode === "offboard") deactivate(broker);
				},
				onError: fail("Couldn't move the clients"),
			},
		);
	};

	return (
		<section className="p-6 sm:p-8">
			{dialog}
			{reassign ?
				<ReassignDialog
					broker={reassign.broker}
					brokers={brokers}
					mode={reassign.mode}
					busy={busy}
					onClose={() => setReassign(null)}
					onConfirm={onReassignConfirm}
					onDeactivateOnly={() => {
						const { broker } = reassign;
						setReassign(null);
						deactivate(broker);
					}}
				/>
			:	null}

			<div className="flex flex-col gap-6">
				<header className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-slate-700 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Team</h1>
						<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
							Add brokers, reset passwords and offboard people who leave, without losing track of their clients.
						</p>
					</div>
					<div className="flex items-center gap-3">
						<label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
							<input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} className="h-4 w-4 accent-emerald-600" />
							Show deactivated
						</label>
						<button
							type="button"
							onClick={() => setFormOpen((open) => !open)}
							className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-950"
						>
							<UserPlus size={16} /> Add broker
						</button>
					</div>
				</header>

				{secret ? <SecretPanel secret={secret} onDismiss={() => setSecret(null)} /> : null}
				{formOpen ? <AddBrokerForm onSubmit={add} onCancel={() => setFormOpen(false)} busy={create.isPending} /> : null}
				{query.isError ? <ErrorState error={query.error} onRetry={query.refetch} /> : null}

				{query.isPending ?
					<LoadingState label="Loading team..." />
				: brokers.length === 0 ?
					<EmptyState title="No brokers yet" hint="Add your first broker with “Add broker”." />
				:	<div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
						<div className="overflow-x-auto">
							<table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
								<thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">
									<tr>
										<th className="px-6 py-3">Broker</th>
										<th className="px-6 py-3">Clients</th>
										<th className="px-6 py-3">Status</th>
										<th className="px-6 py-3">
											<span className="sr-only">Actions</span>
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-slate-100 dark:divide-slate-700">
									{brokers.map((broker) => (
										<tr key={broker._id} className={broker.isActive ? "" : "bg-slate-50/70 dark:bg-slate-900/30"}>
											<td className="px-6 py-4">
												<p className="font-medium text-slate-900 dark:text-white">{broker.name}</p>
												<p className="text-xs text-slate-500 dark:text-slate-400">
													{broker.email} · joined {formatDate(broker.createdAt)}
												</p>
											</td>
											<td className="px-6 py-4 text-sm text-slate-700 dark:text-slate-200">
												{broker.clientCount}
												<span className="ml-1 text-xs text-slate-400">({broker.openClientCount} open)</span>
											</td>
											<td className="px-6 py-4">
												<span
													className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
														broker.isActive ?
															"bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
														:	"bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
													}`}
												>
													{broker.isActive ? "Active" : "Deactivated"}
												</span>
											</td>
											<td className="px-6 py-4">
												<div className="flex flex-wrap justify-end gap-1.5">
													<button
														type="button"
														disabled={busy || !broker.clientCount}
														onClick={() => setReassign({ broker, mode: "move" })}
														className={`${actionButton} text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700`}
													>
														<ArrowRightLeft size={14} /> Move clients
													</button>
													<button
														type="button"
														disabled={busy || broker._id === me?._id}
														onClick={() => onReset(broker)}
														className={`${actionButton} text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700`}
													>
														<KeyRound size={14} /> Reset password
													</button>
													{broker.isActive ?
														<button
															type="button"
															disabled={busy}
															onClick={() => onDeactivate(broker)}
															className={`${actionButton} text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/30`}
														>
															<Power size={14} /> Deactivate
														</button>
													:	<button
															type="button"
															disabled={busy}
															onClick={() => onReactivate(broker)}
															className={`${actionButton} text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/30`}
														>
															<Power size={14} /> Reactivate
														</button>
													}
												</div>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				}
			</div>
		</section>
	);
};

export default Team;

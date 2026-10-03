import {
	ArrowRight,
	BellRing,
	Building2,
	CheckCircle2,
	GitPullRequestArrow,
	Send,
	ShieldCheck,
	Sparkles,
	UserCheck,
} from "lucide-react";

export const PORTFOLIO_URL = "https://portfolio-abhi-aayp.vercel.app/";

const FEATURES = [
	{
		icon: GitPullRequestArrow,
		title: "Approvals that can't go wrong",
		text: "Budget and stage changes wait for an admin. Each approval applies exactly once, and if the data changed in the meantime it's flagged as a conflict instead of overwritten.",
	},
	{
		icon: ShieldCheck,
		title: "A tamper-evident history",
		text: "Every change, upload, approval and login is recorded in a hash-chained audit log. Editing any past entry is detected.",
	},
	{
		icon: UserCheck,
		title: "One owner per buyer",
		text: "Two brokers can't both register the same buyer, even at the same instant. Disputes go to an admin with proof of who came first.",
	},
	{
		icon: Sparkles,
		title: "Matches you can explain",
		text: "Every client gets the listings that fit, ranked on budget, locality, size and bedrooms, each with the reason it scored the way it did.",
	},
	{
		icon: Send,
		title: "Shortlists on WhatsApp",
		text: "Send a buyer one link. They tap Love it, Book a visit or Not for me on their phone, no account needed, and you're notified instantly.",
	},
	{
		icon: BellRing,
		title: "Never miss a price drop",
		text: "When a listing's price falls into a client's budget or it's back on the market, the right broker gets an alert.",
	},
];

const STEPS = [
	{ title: "Add clients and listings", text: "Requirements in lakhs and crores, codes assigned automatically, phone numbers checked for duplicates." },
	{ title: "Work the pipeline", text: "Drag clients across stages; sensitive changes go to an admin, with a full history on every record." },
	{ title: "Share and close", text: "Send matched homes as a shortlist link, see what the buyer liked, and track closures on the dashboard." },
];

const SCREENS = [
	{ src: "/screens/pipeline.jpg", srcSet: "/screens/pipeline-800.jpg 800w, /screens/pipeline.jpg 1600w", alt: "Pipeline board with clients grouped by stage", caption: "Pipeline board", width: 1600, height: 1000 },
	{ src: "/screens/recommendations.jpg", srcSet: "/screens/recommendations-640.jpg 640w, /screens/recommendations.jpg 1280w", alt: "Recommended properties for a client with match scores and reasons", caption: "Explainable matches" },
	{ src: "/screens/buyer.jpg", alt: "A buyer's shortlist on a phone with Love it, Book a visit and Not for me buttons", caption: "Buyer shortlist on WhatsApp", phone: true },
];

/**
 * Public landing page. Pure (no browser APIs while rendering) so it can be
 * pre-rendered to static HTML at build time for search engines and link previews.
 */
const Landing = () => (
	<div className="min-h-screen bg-white text-slate-900">
		<header className="border-b border-slate-100">
			<nav aria-label="Main" className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
				<a href="/" className="inline-flex items-center gap-2 text-lg font-bold tracking-tight">
					<Building2 size={22} className="text-emerald-600" aria-hidden="true" />
					Brokery
				</a>
				<div className="flex items-center gap-2 sm:gap-4">
					<a href="#features" className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:inline">
						Features
					</a>
					<a href="#how-it-works" className="hidden text-sm font-medium text-slate-600 hover:text-slate-900 sm:inline">
						How it works
					</a>
					<a href="/login" className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
						Sign in
					</a>
				</div>
			</nav>
		</header>

		<main>
			<section className="relative overflow-hidden bg-gradient-to-b from-emerald-50 via-white to-white">
				<div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:py-24 lg:grid-cols-[1.05fr_0.95fr]">
					<div>
						<p className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-800">
							CRM for real-estate brokerages
						</p>
						<h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
							The real-estate CRM that keeps every deal honest
						</h1>
						<p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
							Brokery helps brokerage teams manage clients and listings, approve sensitive changes, match buyers to homes and
							share shortlists on WhatsApp, with a tamper-evident record of who did what.
						</p>
						<div className="mt-8 flex flex-wrap gap-3">
							<a
								href="/login?demo=broker"
								className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-700/20 hover:bg-emerald-800"
							>
								Try the live demo <ArrowRight size={16} aria-hidden="true" />
							</a>
							<a href="/login" className="inline-flex items-center rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">
								Sign in
							</a>
						</div>
						<ul className="mt-8 grid gap-2 text-sm text-slate-600 sm:grid-cols-2">
							{["Role-based access for admins and brokers", "Approval queue with conflict detection", "Prices in lakhs and crores", "Works on phones for buyers"].map((point) => (
								<li key={point} className="flex items-center gap-2">
									<CheckCircle2 size={16} className="text-emerald-600" aria-hidden="true" />
									{point}
								</li>
							))}
						</ul>
					</div>
					<figure className="overflow-hidden rounded-2xl border border-slate-200 shadow-2xl shadow-slate-900/10">
						<img
							src="/screens/pipeline.jpg"
							srcSet="/screens/pipeline-800.jpg 800w, /screens/pipeline.jpg 1600w"
							sizes="(min-width: 1024px) 560px, calc(100vw - 40px)"
							alt="Brokery pipeline board showing clients by stage"
							width="1600"
							height="1000"
							fetchPriority="high"
							className="h-auto w-full"
						/>
					</figure>
				</div>
			</section>

			<section id="features" aria-labelledby="features-title" className="mx-auto max-w-6xl px-5 py-20">
				<h2 id="features-title" className="text-3xl font-bold tracking-tight">
					Built for how brokerages actually work
				</h2>
				<p className="mt-3 max-w-2xl text-slate-600">
					Commission depends on who owns a buyer and what was agreed. Brokery makes both provable.
				</p>
				<div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{FEATURES.map(({ icon: Icon, title, text }) => (
						<article key={title} className="rounded-2xl border border-slate-200 p-6">
							<Icon size={24} className="text-emerald-600" aria-hidden="true" />
							<h3 className="mt-4 text-lg font-semibold">{title}</h3>
							<p className="mt-2 text-sm leading-relaxed text-slate-600">{text}</p>
						</article>
					))}
				</div>
			</section>

			<section id="how-it-works" aria-labelledby="how-title" className="bg-slate-50">
				<div className="mx-auto max-w-6xl px-5 py-20">
					<h2 id="how-title" className="text-3xl font-bold tracking-tight">
						How it works
					</h2>
					<ol className="mt-10 grid gap-6 md:grid-cols-3">
						{STEPS.map((step, index) => (
							<li key={step.title} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
								<span className="grid h-9 w-9 place-items-center rounded-full bg-emerald-600 text-sm font-bold text-white">{index + 1}</span>
								<h3 className="mt-4 text-lg font-semibold">{step.title}</h3>
								<p className="mt-2 text-sm leading-relaxed text-slate-600">{step.text}</p>
							</li>
						))}
					</ol>
				</div>
			</section>

			<section aria-labelledby="screens-title" className="mx-auto max-w-6xl px-5 py-20">
				<h2 id="screens-title" className="text-3xl font-bold tracking-tight">
					A look inside
				</h2>
				<div className="mt-10 grid items-start gap-6 lg:grid-cols-[1fr_1fr_0.45fr]">
					{SCREENS.map((screen) => (
						<figure key={screen.src} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
							<img
								src={screen.src}
								srcSet={screen.srcSet}
								sizes={screen.srcSet ? "(min-width: 1024px) 460px, calc(100vw - 40px)" : undefined}
								alt={screen.alt}
								width={screen.width || (screen.phone ? 390 : 1280)}
								height={screen.height || (screen.phone ? 844 : 800)}
								loading="lazy"
								className="h-auto w-full"
							/>
							<figcaption className="border-t border-slate-200 px-4 py-3 text-sm font-medium text-slate-700">{screen.caption}</figcaption>
						</figure>
					))}
				</div>
			</section>

			<section className="bg-slate-950">
				<div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-5 py-14 sm:flex-row sm:items-center">
					<div>
						<h2 className="text-2xl font-bold text-white">See it with real workflows</h2>
						<p className="mt-2 text-slate-300">The demo is a working brokery with clients across Pune, Patna, Guwahati and Bengaluru.</p>
					</div>
					<a
						href="/login?demo=broker"
						className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
					>
						Open the demo <ArrowRight size={16} aria-hidden="true" />
					</a>
				</div>
			</section>
		</main>

		<footer className="border-t border-slate-100">
			<div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
				<p>© {new Date().getFullYear()} Brokery CRM</p>
				<p>
					Built &amp; maintained by{" "}
					<a href={PORTFOLIO_URL} target="_blank" rel="noopener" className="font-semibold text-slate-800 underline-offset-4 hover:underline">
						Abhishek
					</a>
				</p>
			</div>
		</footer>
	</div>
);

export default Landing;

import { useEffect, useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import {
	AlertCircle,
	BarChart3,
	Building2,
	CircleDollarSign,
	TrendingUp,
	Users,
} from "lucide-react";
import {
	getBrokerPerformance,
	getDealsByMonth,
	getPipelineDistribution,
	getPropertyByCity,
	getSummary,
} from "../api/analyticsApi";

const PIE_COLORS = [
	"#0f172a",
	"#0f766e",
	"#14b8a6",
	"#3b82f6",
	"#f59e0b",
	"#ef4444",
];

const formatNumber = (value) =>
	new Intl.NumberFormat("en-IN").format(Number(value || 0));

const formatMonthLabel = (item) => {
	if (!item?._id?.year || !item?._id?.month) return "Unknown";
	return new Date(item._id.year, item._id.month - 1, 1).toLocaleDateString(
		"en-IN",
		{
			month: "short",
			year: "numeric",
		},
	);
};

const Dashboard = () => {
	const [summary, setSummary] = useState(null);
	const [dealsByMonth, setDealsByMonth] = useState([]);
	const [pipelineDistribution, setPipelineDistribution] = useState([]);
	const [brokerPerformance, setBrokerPerformance] = useState([]);
	const [propertyByCity, setPropertyByCity] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		let isMounted = true;

		const loadDashboard = async () => {
			setLoading(true);
			setError("");

			try {
				const [
					summaryResponse,
					dealsResponse,
					pipelineResponse,
					brokerResponse,
					cityResponse,
				] = await Promise.all([
					getSummary(),
					getDealsByMonth(),
					getPipelineDistribution(),
					getBrokerPerformance(),
					getPropertyByCity(),
				]);

				if (!isMounted) return;

				setSummary(summaryResponse.data || {});
				setDealsByMonth(
					Array.isArray(dealsResponse.data) ? dealsResponse.data : [],
				);
				setPipelineDistribution(
					Array.isArray(pipelineResponse.data) ? pipelineResponse.data : [],
				);
				setBrokerPerformance(
					Array.isArray(brokerResponse.data) ? brokerResponse.data : [],
				);
				setPropertyByCity(
					Array.isArray(cityResponse.data) ? cityResponse.data : [],
				);
			} catch (err) {
				if (!isMounted) return;
				setError(
					err.response?.data?.message || "Failed to load dashboard analytics.",
				);
			} finally {
				if (isMounted) setLoading(false);
			}
		};

		loadDashboard();

		return () => {
			isMounted = false;
		};
	}, []);

	const totalProperties =
		summary?.totalProperties ??
		summary?.activeListings ??
		propertyByCity.reduce((total, item) => total + (item?.count || 0), 0);
	const activeBrokers = summary?.activeBrokers ?? brokerPerformance.length;

	const stats = [
		{
			label: "Total Clients",
			value: summary?.totalClients,
			icon: Users,
			tone: "emerald",
		},
		{
			label: "Total Properties",
			value: totalProperties,
			icon: Building2,
			tone: "slate",
		},
		{
			label: "Closed Deals",
			value: summary?.closedDeals,
			icon: CircleDollarSign,
			tone: "teal",
		},
		{
			label: "Active Brokers",
			value: activeBrokers,
			icon: TrendingUp,
			tone: "amber",
		},
	];

	const dealsChartData = dealsByMonth.map((item) => ({
		name: formatMonthLabel(item),
		count: item?.count || 0,
	}));

	const pipelineChartData = pipelineDistribution.map((item) => ({
		name: item?._id || "Unknown",
		value: item?.count || 0,
	}));

	const cityChartData = propertyByCity.map((item) => ({
		name: item?._id || "Unknown",
		count: item?.count || 0,
	}));

	return (
		<section className="p-6 sm:p-8">
			<div className="flex flex-col gap-6">
				<header className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-900 p-6 shadow-sm sm:p-8 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<p className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-200">
							Brokerage analytics
						</p>
						<h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
							Dashboard
						</h1>
						<p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
							Live KPI cards, pipeline trends, broker performance, and city
							inventory pulled from the analytics API.
						</p>
					</div>
					<div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-slate-100 backdrop-blur">
						<BarChart3 size={18} />
						Admin analytics
					</div>
				</header>

				{error ?
					<div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
						<div className="flex items-center gap-2">
							<AlertCircle size={16} />
							{error}
						</div>
					</div>
				:	null}

				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
					{stats.map((stat) => {
						const Icon = stat.icon;

						return (
							<div
								key={stat.label}
								className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm"
							>
								<div className="flex items-start justify-between gap-4">
									<div>
										<p className="text-sm font-medium text-slate-500">
											{stat.label}
										</p>
										<h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
											{loading ? "--" : formatNumber(stat.value)}
										</h2>
									</div>
									<div
										className={`rounded-2xl p-3 ${
											stat.tone === "emerald" ? "bg-emerald-50 text-emerald-700"
											: stat.tone === "teal" ? "bg-teal-50 text-teal-700"
											: stat.tone === "amber" ? "bg-amber-50 text-amber-700"
											: "bg-slate-100 text-slate-700"
										}`}
									>
										<Icon size={20} />
									</div>
								</div>
							</div>
						);
					})}
				</div>

				<div className="grid gap-6 xl:grid-cols-2">
					<div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
						<div className="mb-5 flex items-center justify-between gap-3">
							<div>
								<p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">
									Deals by month
								</p>
								<h3 className="mt-1 text-xl font-semibold text-slate-950">
									Closed deals trend
								</h3>
							</div>
						</div>
						<div className="h-80">
							{loading ?
								<div className="flex h-full items-center justify-center rounded-[1.5rem] bg-slate-50 text-sm text-slate-500">
									Loading deals chart...
								</div>
							:	<ResponsiveContainer width="100%" height="100%">
									<BarChart data={dealsChartData}>
										<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
										<XAxis dataKey="name" tickLine={false} axisLine={false} />
										<YAxis tickLine={false} axisLine={false} />
										<Tooltip />
										<Bar
											dataKey="count"
											fill="#0f766e"
											radius={[12, 12, 0, 0]}
											barSize={28}
										/>
									</BarChart>
								</ResponsiveContainer>
							}
						</div>
					</div>

					<div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
						<div className="mb-5 flex items-center justify-between gap-3">
							<div>
								<p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">
									Pipeline distribution
								</p>
								<h3 className="mt-1 text-xl font-semibold text-slate-950">
									Clients per stage
								</h3>
							</div>
						</div>
						<div className="h-80">
							{loading ?
								<div className="flex h-full items-center justify-center rounded-[1.5rem] bg-slate-50 text-sm text-slate-500">
									Loading pipeline chart...
								</div>
							:	<ResponsiveContainer width="100%" height="100%">
									<PieChart>
										<Pie
											data={pipelineChartData}
											dataKey="value"
											nameKey="name"
											innerRadius={64}
											outerRadius={110}
											paddingAngle={3}
										>
											{pipelineChartData.map((entry, index) => (
												<Cell
													key={`${entry.name}-${index}`}
													fill={PIE_COLORS[index % PIE_COLORS.length]}
												/>
											))}
										</Pie>
										<Tooltip />
									</PieChart>
								</ResponsiveContainer>
							}
						</div>
					</div>
				</div>

				<div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
					<div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
						<div className="mb-5 flex items-center justify-between gap-3">
							<div>
								<p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">
									Broker performance
								</p>
								<h3 className="mt-1 text-xl font-semibold text-slate-950">
									Closed deals per broker
								</h3>
							</div>
						</div>
						<div className="overflow-hidden rounded-[1.5rem] border border-slate-200">
							<div className="overflow-x-auto">
								<table className="min-w-full divide-y divide-slate-200 text-sm">
									<thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
										<tr>
											<th className="px-4 py-3">Broker</th>
											<th className="px-4 py-3">Assigned</th>
											<th className="px-4 py-3">Closed</th>
											<th className="px-4 py-3">Conversion</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100 bg-white">
										{loading ?
											<tr>
												<td className="px-4 py-6 text-slate-500" colSpan={4}>
													Loading broker stats...
												</td>
											</tr>
										: brokerPerformance.length === 0 ?
											<tr>
												<td className="px-4 py-6 text-slate-500" colSpan={4}>
													No broker data available.
												</td>
											</tr>
										:	brokerPerformance.map((broker, index) => (
												<tr key={broker._id || broker.brokerName || index}>
													<td className="px-4 py-4 font-medium text-slate-950">
														{broker.brokerName || "Unassigned"}
													</td>
													<td className="px-4 py-4 text-slate-600">
														{formatNumber(broker.total)}
													</td>
													<td className="px-4 py-4 text-slate-600">
														{formatNumber(broker.closed)}
													</td>
													<td className="px-4 py-4 text-slate-600">
														{broker.conversionRate != null ?
															`${broker.conversionRate}%`
														:	"0%"}
													</td>
												</tr>
											))
										}
									</tbody>
								</table>
							</div>
						</div>
					</div>

					<div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
						<div className="mb-5 flex items-center justify-between gap-3">
							<div>
								<p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-600">
									Inventory by city
								</p>
								<h3 className="mt-1 text-xl font-semibold text-slate-950">
									Properties by city
								</h3>
							</div>
						</div>
						<div className="h-[25rem]">
							{loading ?
								<div className="flex h-full items-center justify-center rounded-[1.5rem] bg-slate-50 text-sm text-slate-500">
									Loading city chart...
								</div>
							:	<ResponsiveContainer width="100%" height="100%">
									<BarChart
										data={cityChartData}
										layout="vertical"
										margin={{ left: 20 }}
									>
										<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
										<XAxis type="number" tickLine={false} axisLine={false} />
										<YAxis
											dataKey="name"
											type="category"
											tickLine={false}
											axisLine={false}
											width={96}
										/>
										<Tooltip />
										<Bar
											dataKey="count"
											fill="#0f172a"
											radius={[0, 12, 12, 0]}
											barSize={18}
										/>
									</BarChart>
								</ResponsiveContainer>
							}
						</div>
					</div>
				</div>
			</div>
		</section>
	);
};

export default Dashboard;

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
			borderClass: "border-l-blue-500",
		},
		{
			label: "Total Properties",
			value: totalProperties,
			borderClass: "border-l-emerald-500",
		},
		{
			label: "Closed Deals",
			value: summary?.closedDeals,
			borderClass: "border-l-orange-500",
		},
		{
			label: "Active Brokers",
			value: activeBrokers,
			borderClass: "border-l-purple-500",
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
				<header className="mb-6 flex flex-col gap-1 border-b border-slate-200 pb-5 dark:border-slate-700 lg:flex-row lg:items-end lg:justify-between">
					<div>
						<h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
							Dashboard
						</h1>
						<p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
							Live KPI cards, pipeline trends, broker performance, and city inventory pulled from the analytics API.
						</p>
					</div>
					<div className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 dark:bg-slate-800 px-4 py-3 text-sm font-medium text-slate-100">
						<BarChart3 size={18} />
						Analytics
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
					{stats.map((stat) => (
						<div
							key={stat.label}
							className={`rounded-r-xl bg-white p-5 shadow-sm border-l-4 ${stat.borderClass} dark:bg-slate-800`}
						>
							<div>
								<p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
									{stat.label}
								</p>
								<h2 className="mt-3 text-3xl font-bold text-slate-950 dark:text-white">
									{loading ? "--" : formatNumber(stat.value)}
								</h2>
							</div>
						</div>
					))}
				</div>

				<div className="grid gap-6 xl:grid-cols-2">
					<div className="rounded-xl border border-slate-200 bg-white p-5 dark:bg-slate-800 dark:border-slate-700">
						<div className="mb-5 flex items-center justify-between gap-3">
							<div>
								<p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
									Monthly closings
								</p>
								<h3 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
									Closed deals trend
								</h3>
							</div>
						</div>
						<div className="h-80">
							{loading ?
								<div className="flex h-full items-center justify-center rounded-[1.5rem] bg-slate-50 text-sm text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">
									Loading deals chart...
								</div>
							:	<ResponsiveContainer width="100%" height="100%">
									<BarChart data={dealsChartData}>
										<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
										<XAxis dataKey="name" tickLine={false} axisLine={false} tick={{fill: '#94a3b8'}} />
										<YAxis tickLine={false} axisLine={false} tick={{fill: '#94a3b8'}} />
										<Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#f8fafc' }} />
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

					<div className="rounded-xl border border-slate-200 bg-white p-5 dark:bg-slate-800 dark:border-slate-700">
						<div className="mb-5 flex items-center justify-between gap-3">
							<div>
								<p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
									Pipeline breakdown
								</p>
								<h3 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
									Clients per stage
								</h3>
							</div>
						</div>
						<div className="h-80">
							{loading ?
								<div className="flex h-full items-center justify-center rounded-[1.5rem] bg-slate-50 text-sm text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">
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
										<Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#f8fafc' }} />
									</PieChart>
								</ResponsiveContainer>
							}
						</div>
					</div>
				</div>

				<div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
					<div className="rounded-xl border border-slate-200 bg-white p-5 dark:bg-slate-800 dark:border-slate-700">
						<div className="mb-5 flex items-center justify-between gap-3">
							<div>
								<p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
									Team performance
								</p>
								<h3 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
									Closed deals per broker
								</h3>
							</div>
						</div>
						<div className="overflow-hidden rounded-[1.5rem] border border-slate-200 dark:border-slate-700">
							<div className="overflow-x-auto">
								<table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700 text-sm">
									<thead className="bg-slate-50 dark:bg-slate-700/50 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
										<tr>
											<th className="px-4 py-3">Broker</th>
											<th className="px-4 py-3">Assigned</th>
											<th className="px-4 py-3">Closed</th>
											<th className="px-4 py-3">Conversion</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
										{loading ?
											<tr>
												<td className="px-4 py-6 text-slate-500 dark:text-slate-400" colSpan={4}>
													Loading broker stats...
												</td>
											</tr>
										: brokerPerformance.length === 0 ?
											<tr>
												<td className="px-4 py-6 text-slate-500 dark:text-slate-400" colSpan={4}>
													No broker data available.
												</td>
											</tr>
										:	brokerPerformance.map((broker, index) => (
												<tr key={broker._id || broker.brokerName || index}>
													<td className="px-4 py-4 font-medium text-slate-950 dark:text-white">
														{broker.brokerName || "Unassigned"}
													</td>
													<td className="px-4 py-4 text-slate-600 dark:text-slate-300">
														{formatNumber(broker.total)}
													</td>
													<td className="px-4 py-4 text-slate-600 dark:text-slate-300">
														{formatNumber(broker.closed)}
													</td>
													<td className="px-4 py-4 text-slate-600 dark:text-slate-300">
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

					<div className="rounded-xl border border-slate-200 bg-white p-5 dark:bg-slate-800 dark:border-slate-700">
						<div className="mb-5 flex items-center justify-between gap-3">
							<div>
								<p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
									Inventory by city
								</p>
								<h3 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">
									Properties by city
								</h3>
							</div>
						</div>
						<div className="h-[25rem]">
							{loading ?
								<div className="flex h-full items-center justify-center rounded-[1.5rem] bg-slate-50 text-sm text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">
									Loading city chart...
								</div>
							:	<ResponsiveContainer width="100%" height="100%">
									<BarChart
										data={cityChartData}
										layout="vertical"
										margin={{ left: 20 }}
									>
										<CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
										<XAxis type="number" tickLine={false} axisLine={false} tick={{fill: '#94a3b8'}} />
										<YAxis
											dataKey="name"
											type="category"
											tickLine={false}
											axisLine={false}
											width={96}
											tick={{fill: '#94a3b8'}}
										/>
										<Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#f8fafc' }} />
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

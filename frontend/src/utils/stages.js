// Pipeline stages in order, with one colour per stage used everywhere.
export const STAGES = [
	{ key: "lead", label: "Lead", dot: "bg-sky-500", badge: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" },
	{ key: "contacted", label: "Contacted", dot: "bg-amber-500", badge: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
	{ key: "site_visit", label: "Site visit", dot: "bg-violet-500", badge: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" },
	{ key: "negotiation", label: "Negotiation", dot: "bg-orange-500", badge: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
	{ key: "closed", label: "Closed", dot: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
	{ key: "lost", label: "Lost", dot: "bg-rose-500", badge: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" },
];

export const STAGE_BY_KEY = Object.fromEntries(STAGES.map((stage) => [stage.key, stage]));

export const stageLabel = (key) => STAGE_BY_KEY[key]?.label || String(key || "").replace(/_/g, " ");

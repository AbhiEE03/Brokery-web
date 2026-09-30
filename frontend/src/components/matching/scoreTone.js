// Match-percentage colour: strong (≥80%), good (≥60%), weak.
export const scoreTone = (score) =>
	score >= 0.8 ? "bg-emerald-500 text-white"
	: score >= 0.6 ? "bg-sky-500 text-white"
	: "bg-amber-400 text-slate-900";

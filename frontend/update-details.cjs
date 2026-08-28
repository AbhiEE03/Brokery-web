const fs = require('fs');
const files = [
  'src/pages/ClientDetail.jsx',
  'src/pages/PropertyDetail.jsx'
];

files.forEach(file => {
  let c = fs.readFileSync(file, 'utf8');

  // Back button
  c = c.replace(/border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50/g, 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 shadow-sm transition hover:bg-slate-50 dark:hover:bg-slate-700/50');

  // Loading / Error Cards
  c = c.replace(/border-slate-200 bg-white p-8/g, 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8');
  c = c.replace(/border-rose-200 bg-rose-50/g, 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-900/20');
  c = c.replace(/text-rose-700/g, 'text-rose-700 dark:text-rose-400');
  c = c.replace(/border-emerald-200 bg-emerald-50/g, 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20');
  c = c.replace(/text-emerald-700/g, 'text-emerald-700 dark:text-emerald-400');

  // Main cards/panels
  c = c.replace(/rounded-\[2rem\] border border-slate-200 bg-white/g, 'rounded-[2rem] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800');
  c = c.replace(/rounded-2xl border border-slate-200 bg-slate-50/g, 'rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50');
  c = c.replace(/rounded-2xl border border-slate-200 bg-white/g, 'rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800');

  // Form inputs
  c = c.replace(/border-slate-200 bg-slate-50 px-4 py-3/g, 'border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-4 py-3');
  c = c.replace(/text-sm outline-none/g, 'text-sm text-slate-950 dark:text-white outline-none');
  
  // File upload input specific
  c = c.replace(/file:bg-slate-950/g, 'file:bg-slate-950 dark:file:bg-slate-700');

  // Typography - Labels
  c = c.replace(/text-slate-600/g, 'text-slate-600 dark:text-slate-400');
  c = c.replace(/text-slate-500/g, 'text-slate-500 dark:text-slate-400');
  
  // Typography - Primary text
  c = c.replace(/text-slate-950/g, 'text-slate-950 dark:text-white');
  
  // Typography - Badges (amber/emerald/slate)
  c = c.replace(/bg-amber-50 px-3 py-1/g, 'bg-amber-50 dark:bg-amber-900/30 px-3 py-1');
  c = c.replace(/text-amber-700/g, 'text-amber-700 dark:text-amber-400');
  c = c.replace(/border-amber-200 bg-amber-50/g, 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20');
  c = c.replace(/text-amber-800/g, 'text-amber-800 dark:text-amber-400');
  
  c = c.replace(/bg-slate-100 px-3 py-1/g, 'bg-slate-100 dark:bg-slate-700 px-3 py-1');
  c = c.replace(/text-slate-700/g, 'text-slate-700 dark:text-slate-300');
  c = c.replace(/bg-slate-100 px-4 py-2/g, 'bg-slate-100 dark:bg-slate-700 px-4 py-2');

  // Buttons
  c = c.replace(/bg-slate-950/g, 'bg-slate-950 dark:bg-slate-700');
  // the file button was modified already above with file:bg-slate-950

  fs.writeFileSync(file, c, 'utf8');
});

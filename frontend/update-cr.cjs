const fs = require('fs');
let c = fs.readFileSync('src/pages/ChangeRequests.jsx', 'utf8');

// 1. Filter dropdown container
c = c.replace(/rounded-\[2rem\] border border-slate-200 bg-white/g, 'rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800');

// 2. Filter dropdowns / inputs
c = c.replace(/border-slate-200 bg-slate-50/g, 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50');
c = c.replace(/text-slate-700 outline-none/g, 'text-slate-700 dark:text-slate-300 outline-none');
c = c.replace(/text-slate-950 outline-none/g, 'text-slate-950 dark:text-white outline-none');

// 3. Table Container (it uses rounded-[2rem] border border-slate-200 bg-white too, already caught by 1)
// Wait, I used /g for the first one, let's verify if table container matched.
// The filter container is: "rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2"
// The table container is: "rounded-[2rem] border border-slate-200 bg-white shadow-sm"

// 4. Table Header
c = c.replace(/bg-slate-50 text-left text-xs/g, 'bg-slate-50 dark:bg-slate-700/50 text-left text-xs');
c = c.replace(/text-slate-500">/g, 'text-slate-500 dark:text-slate-400">');

// 5. Table Body
c = c.replace(/divide-slate-100 bg-white/g, 'divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800');
c = c.replace(/transition hover:bg-slate-50/g, 'transition hover:bg-slate-50 dark:hover:bg-slate-700/30');

// 6. Request Badges
c = c.replace(/bg-slate-100 px-3 py-1/g, 'bg-slate-100 dark:bg-slate-700 px-3 py-1');
c = c.replace(/text-slate-700">/g, 'text-slate-700 dark:text-slate-300">');
c = c.replace(/bg-emerald-50 text-emerald-700/g, 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400');
c = c.replace(/bg-rose-50 text-rose-700/g, 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400');
c = c.replace(/bg-amber-50 text-amber-700/g, 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400');

// 7. Text colors in table cells
c = c.replace(/text-sm text-slate-500/g, 'text-sm text-slate-500 dark:text-slate-400');
c = c.replace(/text-sm text-slate-600/g, 'text-sm text-slate-600 dark:text-slate-400');
c = c.replace(/font-medium text-slate-950/g, 'font-medium text-slate-950 dark:text-white');

// 8. Diff Cards
// Old: rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3
c = c.replace(/rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3/g, 'rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-4 py-3');

// Old Value Container
c = c.replace(/bg-rose-50 px-3 py-1 font-medium text-rose-700/g, 'bg-rose-50 dark:bg-rose-900/20 border border-transparent dark:border-rose-800 border-rose-200 px-3 py-1 font-medium text-rose-700 dark:text-rose-400');
// The prompt specified exactly: border-rose-200 dark:border-rose-800
c = c.replace(/border border-transparent dark:border-rose-800 border-rose-200/g, 'border border-rose-200 dark:border-rose-800');

// New Value Container
c = c.replace(/bg-emerald-50 px-3 py-1 font-medium text-emerald-700/g, 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-3 py-1 font-medium text-emerald-700 dark:text-emerald-400');

// 9. Pagination footer
c = c.replace(/border-t border-slate-200 bg-slate-50/g, 'border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50');
c = c.replace(/border-slate-200 bg-white/g, 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800');

fs.writeFileSync('src/pages/ChangeRequests.jsx', c, 'utf8');
console.log("Done");

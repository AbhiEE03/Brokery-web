const fs = require('fs');
const files = [
  'src/pages/Clients.jsx',
  'src/pages/Properties.jsx',
  'src/pages/Matches.jsx',
  'src/pages/ActivityLog.jsx'
];

files.forEach(file => {
  let c = fs.readFileSync(file, 'utf8');

  // 1. Containers and Filters
  c = c.replace(/rounded-\[2rem\] border border-slate-200 bg-white p-4 shadow-sm/g, 'rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm');
  
  // 2. Forms
  c = c.replace(/rounded-\[2rem\] border border-slate-200 bg-white p-6 shadow-sm/g, 'rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm');

  // 3. Table Wrapper
  c = c.replace(/rounded-\[2rem\] border border-slate-200 bg-white shadow-sm/g, 'rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm');

  // 4. Inputs inside filters/forms
  c = c.replace(/border-slate-200 bg-slate-50 px-4 py-3/g, 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 px-4 py-3');
  
  // 5. Input text
  c = c.replace(/bg-transparent text-sm text-slate-950/g, 'bg-transparent text-sm text-slate-950 dark:text-white');
  c = c.replace(/text-slate-700 outline-none/g, 'text-slate-700 dark:text-slate-300 outline-none');

  // 6. Form Cancel button
  c = c.replace(/border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700/g, 'border-slate-200 dark:border-slate-700 px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300');

  // 7. Form Labels
  c = c.replace(/text-sm font-medium text-slate-600/g, 'text-sm font-medium text-slate-600 dark:text-slate-400');

  // 8. Table Header
  c = c.replace(/bg-slate-50 text-left text-xs/g, 'bg-slate-50 dark:bg-slate-700/50 text-left text-xs');
  c = c.replace(/uppercase tracking-\[0.18em\] text-slate-500/g, 'uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400');

  // 9. Table Body
  c = c.replace(/divide-y divide-slate-100 bg-white/g, 'divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800');
  
  // 10. Table Row Hover
  c = c.replace(/transition hover:bg-slate-50/g, 'transition hover:bg-slate-50 dark:hover:bg-slate-700/30');

  // 11. Text colors in table cells
  c = c.replace(/font-medium text-slate-950/g, 'font-medium text-slate-950 dark:text-white');
  c = c.replace(/text-sm text-slate-500/g, 'text-sm text-slate-500 dark:text-slate-400');
  c = c.replace(/text-sm text-slate-600/g, 'text-sm text-slate-600 dark:text-slate-400');

  // 12. Pagination
  c = c.replace(/border-t border-slate-200 bg-slate-50/g, 'border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/50');
  c = c.replace(/bg-white px-3 py-2 text-sm font-medium text-slate-700/g, 'bg-white dark:bg-slate-800 px-3 py-2 text-sm font-medium text-slate-700 dark:text-slate-300');

  // 13. Properties grid cards
  c = c.replace(/rounded-\[2rem\] border border-slate-200 bg-white p-5/g, 'rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5');
  c = c.replace(/text-xl font-semibold tracking-tight text-slate-950/g, 'text-xl font-semibold tracking-tight text-slate-950 dark:text-white');

  fs.writeFileSync(file, c, 'utf8');
  console.log(`Updated ${file}`);
});

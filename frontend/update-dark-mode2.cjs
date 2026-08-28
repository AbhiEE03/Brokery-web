const fs = require('fs');
const files = [
  'src/pages/Clients.jsx',
  'src/pages/Properties.jsx',
  'src/pages/Matches.jsx',
  'src/pages/ActivityLog.jsx'
];

files.forEach(file => {
  let c = fs.readFileSync(file, 'utf8');

  // Input text color
  c = c.replace(/text-sm outline-none/g, 'text-sm text-slate-950 dark:text-white outline-none');
  
  // Table divide
  c = c.replace(/min-w-full divide-y divide-slate-200"/g, 'min-w-full divide-y divide-slate-200 dark:divide-slate-700"');

  // Properties Card details
  c = c.replace(/text-slate-600/g, 'text-slate-600 dark:text-slate-400');
  
  fs.writeFileSync(file, c, 'utf8');
});

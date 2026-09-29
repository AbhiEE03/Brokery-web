# Brokery CRM — Frontend

React 19 + Vite SPA for Brokery CRM. See the [root README](../README.md) for the full project overview.

## Scripts

```bash
cp .env.example .env   # set VITE_API_URL
npm install
npm run dev            # http://localhost:5173
npm run lint           # oxlint
npm run build          # production build into dist/
```

## Structure

- `src/api/` — one Axios wrapper per backend resource (`axiosInstance.js` adds the Bearer token)
- `src/store/` — Redux Toolkit auth slice (persisted to localStorage)
- `src/components/layout/` — `ProtectedRoute`, `Sidebar`
- `src/pages/` — one component per route

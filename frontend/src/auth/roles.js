// Where each role lands after login and when a route isn't allowed for them.
// The dashboard is built from admin-only analytics, so brokers start on Clients.
export const homePathFor = (user) => (user?.role === "admin" ? "/dashboard" : "/clients");

export const isAdmin = (user) => user?.role === "admin";

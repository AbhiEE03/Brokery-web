import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import Root from "./Root.jsx";
import store from "./store/store";

const container = document.getElementById("root");
const app = <Root Router={BrowserRouter} />;

// "/" arrives as pre-rendered HTML (see scripts/prerender.mjs). For a signed-out
// visitor, React hydrates it: attaches to the existing markup instead of
// rebuilding it. Everywhere else (and for signed-in users, who are redirected)
// the page renders from scratch.
const prerendered = container.firstElementChild && window.location.pathname === "/" && !store.getState().auth.token;

if (prerendered) {
	hydrateRoot(container, app);
} else {
	container.textContent = "";
	createRoot(container).render(app);
}

import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom";
import Root from "./Root.jsx";

// Build-time only: renders a public URL to HTML in Node (no browser), using the
// same tree as the browser so React can hydrate it.
export const render = (url) => renderToString(<Root Router={StaticRouter} routerProps={{ location: url }} />);

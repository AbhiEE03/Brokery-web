/**
 * Runs after `vite build` (see the "build" script in package.json).
 *
 * Writes three HTML files from dist/index.html:
 *   index.html     "/" with the landing page pre-rendered: indexable, real content
 *                  for crawlers and link previews before any JavaScript runs.
 *   app.html       empty shell for every signed-in route: noindex.
 *   shortlist.html shell for /s/:token buyer links: noindex, with its own
 *                  WhatsApp preview text.
 * vercel.json routes requests to them (real files are served first).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const ssrDir = path.join(root, "dist-ssr");

const template = fs.readFileSync(path.join(dist, "index.html"), "utf8");
const { render } = await import(pathToFileURL(path.join(ssrDir, "entry-prerender.js")).href);

const replaceOrFail = (html, pattern, replacement) => {
	const found = typeof pattern === "string" ? html.includes(pattern) : pattern.test(html);
	if (!found) throw new Error(`prerender: pattern not found: ${pattern}`);
	return html.replace(pattern, replacement);
};

// Pages that must never appear in search results.
const noindex = (html) =>
	replaceOrFail(
		replaceOrFail(html, /<meta name="robots" content="[^"]*"\s*\/>/, '<meta name="robots" content="noindex, nofollow" />'),
		/\s*<link rel="canonical"[^>]*>/,
		"",
	);

// 1. Landing page, pre-rendered.
const landing = render("/");
if (!landing.includes("<h1")) throw new Error("prerender: landing page rendered without an <h1>");
fs.writeFileSync(path.join(dist, "index.html"), replaceOrFail(template, "<!--app-html-->", landing));

// 2. App shell.
const appShell = noindex(replaceOrFail(template, "<!--app-html-->", ""));
fs.writeFileSync(path.join(dist, "app.html"), appShell);

// 3. Buyer shortlist shell: a friendly preview card, never indexed.
const set = (html, attr, name, value) =>
	// \s+ between attributes: tags may be split across lines in the source HTML.
	replaceOrFail(html, new RegExp(`<meta\\s+${attr}="${name}"\\s+content="[^"]*"\\s*/>`), `<meta ${attr}="${name}" content="${value}" />`);
let shortlist = replaceOrFail(appShell, /<title>[^<]*<\/title>/, "<title>Your property shortlist · Brokery</title>");
shortlist = set(shortlist, "name", "description", "Homes your broker picked for you. Tap the ones you like.");
shortlist = set(shortlist, "property", "og:title", "Homes picked for you");
shortlist = set(shortlist, "property", "og:description", "Your broker shortlisted these homes. Tap Love it, Book a visit or Not for me.");
shortlist = set(shortlist, "name", "twitter:title", "Homes picked for you");
shortlist = set(shortlist, "name", "twitter:description", "Your broker shortlisted these homes. Tap the ones you like.");
shortlist = replaceOrFail(shortlist, /\s*<meta property="og:url"[^>]*>/, "");
fs.writeFileSync(path.join(dist, "shortlist.html"), shortlist);

fs.rmSync(ssrDir, { recursive: true, force: true });
console.log(`prerender: index.html (${Math.round(landing.length / 1024)} KB of landing HTML), app.html, shortlist.html`);

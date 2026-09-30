const express = require("express");
const helmet = require("helmet");
const { buildOpenApi } = require("./build");

// Swagger UI from jsDelivr, pinned. Only this page gets a CSP that allows it;
// the rest of the API keeps Helmet's default policy.
const SWAGGER = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14";

const router = express.Router();
let spec; // built once; the route table doesn't change at runtime

router.get("/openapi.json", (req, res) => {
	spec = spec || buildOpenApi();
	res.json(spec);
});

const docsCsp = helmet.contentSecurityPolicy({
	directives: {
		defaultSrc: ["'self'"],
		scriptSrc: ["'self'", "https://cdn.jsdelivr.net"],
		styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
		imgSrc: ["'self'", "data:", "https://cdn.jsdelivr.net"],
		connectSrc: ["'self'"],
	},
});

router.get("/docs", docsCsp, (req, res) => {
	res.type("html").send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Brokery API</title>
<link rel="stylesheet" href="${SWAGGER}/swagger-ui.css" />
</head>
<body>
<div id="swagger-ui"></div>
<script src="${SWAGGER}/swagger-ui-bundle.js"></script>
<script src="docs/init.js"></script>
</body>
</html>`);
});

router.get("/docs/init.js", (req, res) => {
	res.type("application/javascript").send(
		'window.ui = SwaggerUIBundle({ url: "openapi.json", dom_id: "#swagger-ui", deepLinking: true, persistAuthorization: true });',
	);
});

module.exports = router;

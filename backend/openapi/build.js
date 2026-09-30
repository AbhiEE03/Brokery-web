/**
 * Builds the OpenAPI 3.1 document from openapi/routes.js, converting the Zod
 * request schemas with Zod's own JSON Schema output ("input" shape: what a
 * client sends, before defaults and transforms).
 */
const { z } = require("zod");
const { routes } = require("./routes");

const toSchema = (schema) => {
	const json = z.toJSONSchema(schema, { io: "input", unrepresentable: "any" });
	delete json.$schema;
	return json;
};

const pathParamNames = (path) => [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);

const parametersFor = (route) => {
	const params = [];
	const pathProps = route.params ? toSchema(route.params).properties || {} : {};
	for (const name of pathParamNames(route.path)) {
		params.push({ name, in: "path", required: true, schema: pathProps[name] || { type: "string" } });
	}
	if (route.query) {
		const query = toSchema(route.query);
		const required = new Set(query.required || []);
		for (const [name, schema] of Object.entries(query.properties || {})) {
			params.push({ name, in: "query", required: required.has(name), schema });
		}
	}
	return params;
};

const ERROR = { $ref: "#/components/schemas/Error" };
const errorResponse = (description) => ({ description, content: { "application/json": { schema: ERROR } } });

const buildOpenApi = ({ serverUrl = "/api" } = {}) => {
	const paths = {};
	for (const route of routes) {
		const operation = {
			tags: [route.tag],
			summary: route.summary,
			...(route.deprecated ? { deprecated: true } : {}),
			...(route.auth === "public" ? { security: [] } : {}),
			parameters: parametersFor(route),
			responses: {
				200: { description: "OK. Body: `{ success: true, data, pagination? }`" },
				400: errorResponse("Validation failed"),
				...(route.auth !== "public" ? { 401: errorResponse("Missing or invalid token") } : {}),
				...(route.auth === "admin" || route.params ? { 403: errorResponse("Not allowed for this user") } : {}),
				...(route.params || route.path.includes("{") ? { 404: errorResponse("Not found") } : {}),
				429: errorResponse("Rate limited"),
			},
		};
		if (route.body) {
			operation.requestBody = { required: true, content: { "application/json": { schema: toSchema(route.body) } } };
		}
		if (route.multipart) {
			operation.requestBody = {
				required: true,
				content: { "multipart/form-data": { schema: { type: "object", properties: { file: { type: "string", format: "binary" }, type: { type: "string" } }, required: ["file"] } } },
			};
		}
		if (route.auth === "admin") operation.description = "Admins only.";
		paths[route.path] = { ...(paths[route.path] || {}), [route.method]: operation };
	}

	return {
		openapi: "3.1.0",
		info: {
			title: "Brokery CRM API",
			version: "1.0.0",
			description:
				"Role-based CRM for real-estate brokerages. All responses use `{ success, data }` or " +
				"`{ success: false, code, message, requestId }`. Send `Authorization: Bearer <token>` from `POST /auth/login`.",
		},
		servers: [{ url: serverUrl }],
		security: [{ bearer: [] }],
		components: {
			securitySchemes: { bearer: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
			schemas: {
				Error: {
					type: "object",
					properties: {
						success: { const: false },
						code: { type: "string", examples: ["VALIDATION_ERROR", "CLIENT_ALREADY_REGISTERED"] },
						message: { type: "string" },
						requestId: { type: "string" },
						details: { type: "object" },
					},
				},
			},
		},
		tags: [...new Set(routes.map((r) => r.tag))].map((name) => ({ name })),
		paths,
	};
};

module.exports = { buildOpenApi };

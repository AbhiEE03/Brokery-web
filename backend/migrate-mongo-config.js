// Migrations run against MONGO_URI from .env. Take a backup first:
//   mongodump --uri "$MONGO_URI" --out backup-$(date +%F)
//   npm run migrate:status && npm run migrate:up
require("dotenv").config();

module.exports = {
	mongodb: {
		url: process.env.MONGO_URI,
		options: {},
	},
	migrationsDir: "migrations",
	changelogCollectionName: "changelog",
	migrationFileExtension: ".js",
	useFileHash: false,
	moduleSystem: "commonjs",
};

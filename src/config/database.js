const fs = require("node:fs");
const { Pool } = require("pg");
const { normalizeConnectionString } = require("./db-url");

function getSslOptions() {
  if (process.env.DATABASE_SSL !== "true") return false;
  const caFile = process.env.DATABASE_CA_CERT_PATH;
  const inlineCa = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
  const ca = inlineCa || (caFile ? fs.readFileSync(caFile, "utf8") : undefined);
  return { rejectUnauthorized: true, ...(ca ? { ca } : {}) };
}

const pool = new Pool({
  connectionString: normalizeConnectionString(process.env.DATABASE_URL),
  ssl: getSslOptions(),
  max: 10,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  statement_timeout: 30000
});
module.exports = pool;

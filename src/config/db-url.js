// URI sslmode/sslcert/etc. override explicit pg.ssl settings; remove them
// so TLS certificate validation cannot be silently downgraded.
function normalizeConnectionString(connectionString) {
  if (!connectionString) return connectionString;
  const parsed = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) {
    throw new Error("DATABASE_URL debe utilizar el protocolo PostgreSQL.");
  }
  for (const param of ["sslmode", "sslcert", "sslkey", "sslrootcert"]) {
    parsed.searchParams.delete(param);
  }
  return parsed.toString();
}
module.exports = { normalizeConnectionString };

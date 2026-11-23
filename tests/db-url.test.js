const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeConnectionString } = require("../src/config/db-url");

test("connection string sslmode cannot disable explicit TLS verification", () => {
  const result = normalizeConnectionString("postgresql://u:secret@db.example:5432/coinpsi?sslmode=no-verify&application_name=coinpsi");
  assert.equal(new URL(result).searchParams.has("sslmode"), false);
  assert.equal(new URL(result).searchParams.get("application_name"), "coinpsi");
});

test("database URL rejects non-PostgreSQL schemes", () => {
  assert.throws(() => normalizeConnectionString("https://example.com/database"), /PostgreSQL/);
});

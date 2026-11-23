const test = require("node:test");
const assert = require("node:assert/strict");
const { assertProductionSecurity } = require("../src/config/security");

test("production rejects unencrypted DB connection", () => {
  const saved = { ...process.env };
  try {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_SSL = "false";
    process.env.JWT_SECRET = "x".repeat(64);
    assert.throws(assertProductionSecurity, /DATABASE_SSL=true/);
  } finally {
    for (const key of ["NODE_ENV", "DATABASE_SSL", "JWT_SECRET"]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});

test("production requires a strong JWT secret", () => {
  const saved = { ...process.env };
  try {
    process.env.NODE_ENV = "production";
    process.env.DATABASE_SSL = "true";
    process.env.JWT_SECRET = "short";
    assert.throws(assertProductionSecurity, /JWT_SECRET/);
  } finally {
    for (const key of ["NODE_ENV", "DATABASE_SSL", "JWT_SECRET"]) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});

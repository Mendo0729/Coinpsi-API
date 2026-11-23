const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");

// Prevent a repeat of the credentials accidentally committed to this public repo.
test("no private environment or Google OAuth token files are tracked", () => {
  const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .trim()
    .split(/\r?\n/);
  const forbidden = tracked.filter((path) =>
    /(^|\/)(?:Coinpsi-API\.env|\.env(?:\.[^/]+)?|\.google-drive-token\.json)$/.test(path)
    && !path.endsWith("/.env.example")
    && path !== ".env.example"
  );
  assert.deepEqual(forbidden, [], "Private environment and Google Drive tokens must not be committed.");
});

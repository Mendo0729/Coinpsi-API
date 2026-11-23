const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const app = require("../src/app");

async function withServer(callback) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try { return await callback("http://127.0.0.1:" + server.address().port); }
  finally { await new Promise((resolve) => server.close(resolve)); }
}

test("Helmet supplies security headers without framework banner", async () => {
  await withServer(async (url) => {
    const response = await fetch(url + "/not-found");
    assert.equal(response.headers.get("x-powered-by"), null);
    assert.ok(response.headers.get("x-content-type-options"));
    assert.ok(response.headers.get("content-security-policy"));
  });
});

test("CORS rejects untrusted origins with JSON", async () => {
  await withServer(async (url) => {
    const response = await fetch(url + "/api/v1/auth/login", {
      method: "POST", headers: { origin: "https://evil.invalid", "content-type": "application/json" },
      body: JSON.stringify({ username: "x", password: "y" })
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).error, "ORIGIN_NOT_ALLOWED");
  });
});

test("admin routes deny missing bearer tokens without database access", async () => {
  await withServer(async (url) => {
    const response = await fetch(url + "/api/v1/admin/events");
    assert.equal(response.status, 401);
  });
});

test("invalid JSON returns HTTP 400", async () => {
  await withServer(async (url) => {
    const response = await fetch(url + "/api/v1/auth/login", {
      method: "POST", headers: { "content-type": "application/json" }, body: "{invalid"
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "INVALID_JSON");
  });
});

test("OAuth callback uses a nonce-restricted CSP and no-store", async () => {
  await withServer(async (url) => {
    const response = await fetch(url + "/api/v1/google/oauth/callback");
    assert.equal(response.status, 400);
    assert.match(response.headers.get("content-security-policy"), /script-src 'nonce-[A-Za-z0-9+/=]+'/);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const html = await response.text();
    assert.match(html, /<script nonce="[A-Za-z0-9+/=]+">/);
  });
});

test("login rate limit blocks repeated invalid requests", async () => {
  await withServer(async (url) => {
    let last;
    for (let i = 0; i < 9; i += 1) {
      last = await fetch(url + "/api/v1/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "", password: "" })
      });
    }
    assert.equal(last.status, 429);
    assert.equal((await last.json()).error, "RATE_LIMITED");
  });
});

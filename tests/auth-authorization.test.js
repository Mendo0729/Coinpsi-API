const test = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

// Inject a stub before loading the middleware, so no real database is queried.
const repo = require("../src/repositories/admin-user.repository");
const originalLookup = repo.findAdminById;
let adminResult;
repo.findAdminById = async () => {
  if (adminResult instanceof Error) throw adminResult;
  return adminResult;
};
const middlewarePath = require.resolve("../src/middleware/require-auth");
delete require.cache[middlewarePath];
const requireAuth = require(middlewarePath);
repo.findAdminById = originalLookup;

const previousSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = "isolated-unit-test-secret-32-bytes-minimum";

// Restore process state for other tests in this process.
test.after(() => {
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
  delete require.cache[middlewarePath];
});

function token(options = {}) {
  return jwt.sign(
    { role: "admin", username: "example" },
    process.env.JWT_SECRET,
    {
      subject: "42",
      issuer: "coinpsi-api",
      audience: "coinpsi-admin",
      expiresIn: "1h",
      ...options
    }
  );
}

async function invoke(value) {
  const req = { headers: { authorization: value ? `Bearer ${value}` : "" } };
  let nextCalled = 0;
  const res = {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  await requireAuth(req, res, () => { nextCalled += 1; });
  return { req, res, nextCalled };
}

test("administrative routes reject missing token", async () => {
  adminResult = null;
  const { res, nextCalled } = await invoke();
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, 0);
});

test("administrative routes reject tokens with invalid signatures", async () => {
  adminResult = null;
  const { res, nextCalled } = await invoke("bad.invalid.token");
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, 0);
});

test("administrative routes reject JWT for another audience", async () => {
  adminResult = null;
  const { res } = await invoke(token({ audience: "another-service" }));
  assert.equal(res.statusCode, 401);
});

test("administrative routes reject expired JWT", async () => {
  adminResult = null;
  const { res } = await invoke(token({ expiresIn: "-1s" }));
  assert.equal(res.statusCode, 401);
});

test("administrative routes reject deactivated users even with a valid token", async () => {
  adminResult = { id: 42, username: "example", role: "admin", is_active: false };
  const { res, nextCalled } = await invoke(token());
  assert.equal(res.statusCode, 401);
  assert.equal(nextCalled, 0);
});

test("administrative routes reject users whose database role is not admin", async () => {
  adminResult = { id: 42, username: "example", role: "viewer", is_active: true };
  const { res, nextCalled } = await invoke(token());
  assert.equal(res.statusCode, 403);
  assert.equal(nextCalled, 0);
});

test("valid active administrators can access routes", async () => {
  adminResult = { id: 42, username: "example", role: "admin", is_active: true };
  const { req, res, nextCalled } = await invoke(token());
  assert.equal(nextCalled, 1);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(req.auth, { userId: "42", username: "example", role: "admin" });
});

test("database outages deny access instead of bypassing authorization", async () => {
  adminResult = new Error("database unavailable");
  const oldError = console.error;
  console.error = () => undefined;
  try {
    const { res, nextCalled } = await invoke(token());
    assert.equal(res.statusCode, 503);
    assert.equal(nextCalled, 0);
  } finally {
    console.error = oldError;
  }
});

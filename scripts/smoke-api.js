// Read-only integration checks against the deployed API.
// Uses Node's built-in fetch; no npm packages or credentials required.
const assert = require("node:assert/strict");

const base = new URL(process.env.API_BASE_URL || "https://coinpsi-api.mendotech.lat");
if (base.protocol !== "https:") throw new Error("Smoke tests require HTTPS");

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function get(path, { expected = 200, attempts = 2, requireHelmet = false } = {}) {
  let detail = "";
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const url = new URL(path, base);
      const response = await fetch(url, {
        method: "GET",
        redirect: "error",
        signal: AbortSignal.timeout(40000),
        headers: { accept: "application/json" }
      });
      const hasHelmet = response.headers.get("x-content-type-options") === "nosniff";
      if (response.status === expected && (!requireHelmet || hasHelmet)) {
        return response;
      }
      detail = `${path}: HTTP ${response.status}; security headers: ${hasHelmet ? "present" : "missing"}`;
      await response.body?.cancel();
    } catch (error) {
      detail = `${path}: ${error.cause?.code || error.message}`;
    }

    if (attempt < attempts) {
      console.log(`Retry ${attempt}/${attempts}: ${detail}`);
      await pause(15000);
    }
  }
  throw new Error(`Smoke test failed: ${detail}`);
}

async function main() {
  // Poll for the newly deployed code, not only an older healthy release.
  const health = await get("/health", { attempts: 15, requireHelmet: true });
  const healthBody = await health.json();
  assert.equal(healthBody.status, "ok");
  assert.equal(healthBody.database?.status, "connected");
  console.log("PASS /health — secured API and database connected");

  const events = await (await get("/api/v1/events", { attempts: 3 })).json();
  assert.equal(events.status, "ok");
  assert.ok(Array.isArray(events.events));
  console.log("PASS /api/v1/events");

  const knowledge = await (await get("/api/v1/knowledge/posts", { attempts: 3 })).json();
  assert.equal(knowledge.status, "ok");
  assert.ok(Array.isArray(knowledge.posts));
  console.log("PASS /api/v1/knowledge/posts");

  const gallery = await (await get("/api/v1/gallery", { attempts: 3 })).json();
  assert.equal(gallery.status, "ok");
  assert.ok(Array.isArray(gallery.items));
  console.log(`PASS /api/v1/gallery (${gallery.items.length} items)`);

  if (gallery.items.length > 0 && gallery.items[0].imagePath) {
    const url = new URL(gallery.items[0].imagePath, base);
    assert.equal(url.origin, base.origin, "Gallery image must remain on the API origin");
    const img = await get(url.pathname + url.search, { attempts: 3 });
    assert.match(img.headers.get("content-type") || "", /^image\//);
    await img.body?.cancel();
    console.log("PASS /api/v1/gallery/images/... — selected image accessible");
  }

  const admin = await get("/api/v1/admin/events", { expected: 401 });
  await admin.body?.cancel();
  console.log("PASS /api/v1/admin/events — denies anonymous access");

  console.log("PASS — production smoke tests completed");
}

main().catch((error) => {
  console.error("FAIL — " + error.message);
  process.exitCode = 1;
});

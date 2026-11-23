const test = require("node:test");
const assert = require("node:assert/strict");
const { once } = require("node:events");
const { validateContact } = require("../src/validators/contact.validator");
const { buildContactEmail, sendContactEmail } = require("../src/services/contact-email.service");
process.env.LANDING_ORIGIN = "https://coinpsi.org";
const app = require("../src/app");

const sample = {
  fullName: "Ana Pérez",
  email: "ANA.PEREZ@example.com",
  phone: "+507 6000-0000",
  serviceType: "consulta-psicologica",
  message: "Hola, quisiera información para agendar una consulta.",
  submissionId: "f6b1a2c3-4d5e-4f70-8a9b-0c1d2e3f4a5b"
};

test("valida y normaliza los datos de un contacto", () => {
  const result = validateContact(sample);
  assert.equal(result.valid, true);
  assert.equal(result.data.email, "ana.perez@example.com");
  assert.equal(result.data.serviceLabel, "Consulta Psicológica");
});

test("no permite mensajes vacíos, campos arbitrarios ni correo con cabeceras maliciosas", () => {
  const invalid = validateContact({
    ...sample,
    email: "usuario@example.com\r\nBcc:other@example.com",
    serviceType: "desconocido",
    message: " ",
    submissionId: "non-uuid"
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.email);
  assert.ok(invalid.errors.serviceType);
  assert.ok(invalid.errors.message);
  assert.ok(invalid.errors.submissionId);
});

test("la plantilla HTML neutraliza etiquetas y conserva el texto", () => {
  const data = validateContact({
    ...sample,
    message: "Necesito información <script>alert('x')</script> sobre consultas."
  }).data;
  const email = buildContactEmail(data);
  assert.equal(email.to[0], "info@coinpsi.org");
  assert.equal(email.reply_to, "ana.perez@example.com");
  assert.doesNotMatch(email.html, /<script>/);
  assert.match(email.html, /&lt;script&gt;/);
  assert.match(email.text, /<script>/);
});

test("Resend usa Bearer token, remitente fijo e idempotencia por formulario", async () => {
  const original = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "re_test_mock";
  try {
    let observed;
    const result = await sendContactEmail(validateContact(sample).data, {
      fetchImpl: async (url, options) => {
        observed = { url, options, body: JSON.parse(options.body) };
        return new Response(JSON.stringify({ id: "resend-test-id" }), {
          status: 200, headers: { "content-type": "application/json" }
        });
      }
    });
    assert.equal(result.id, "resend-test-id");
    assert.equal(observed.url, "https://api.resend.com/emails");
    assert.equal(observed.options.headers.Authorization, "Bearer re_test_mock");
    assert.equal(observed.options.headers["Idempotency-Key"], "coinpsi-contact/" + sample.submissionId);
    assert.equal(observed.body.from, "COINPSI <notificaciones@coinpsi.org>");
    assert.equal(observed.body.reply_to, "ana.perez@example.com");
  } finally {
    if (original === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = original;
  }
});

test("un error del proveedor no se presenta como enviado", async () => {
  const original = process.env.RESEND_API_KEY;
  process.env.RESEND_API_KEY = "re_test_mock";
  const oldLog = console.error;
  console.error = () => {};
  try {
    await assert.rejects(
      sendContactEmail(validateContact(sample).data, {
        fetchImpl: async () => new Response(JSON.stringify({message:"bad request"}), {status:422})
      }),
      { code: "CONTACT_DELIVERY_FAILED" }
    );
  } finally {
    console.error = oldLog;
    if (original === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = original;
  }
});

async function withServer(callback) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    return await callback("http://127.0.0.1:" + server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test("el endpoint valida, ignora spam y no confirma si falta Resend", async () => {
  const original = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  const oldLog = console.error;
  console.error = () => {};
  try {
    await withServer(async (base) => {
      async function post(body, origin = "https://coinpsi.org") {
        const response = await fetch(base + "/api/v1/contact", {
          method: "POST",
          headers: { "content-type": "application/json", origin },
          body: JSON.stringify(body)
        });
        return { status: response.status, body: await response.json(), origin: response.headers.get("access-control-allow-origin") };
      }
      const invalid = await post({ ...sample, email: "invalido" });
      assert.equal(invalid.status, 422);
      assert.equal(invalid.body.error, "VALIDATION_ERROR");

      const honeypot = await post({ ...sample, website: "https://spam.invalid" });
      assert.equal(honeypot.status, 200);
      assert.equal(honeypot.body.status, "ok");

      const unconfigured = await post(sample, "https://www.coinpsi.org");
      assert.equal(unconfigured.status, 503);
      assert.equal(unconfigured.body.error, "CONTACT_UNAVAILABLE");
      assert.equal(unconfigured.origin, "https://www.coinpsi.org");
    });
  } finally {
    console.error = oldLog;
    if (original === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = original;
  }
});

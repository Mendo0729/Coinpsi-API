function assertProductionSecurity() {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.DATABASE_SSL !== "true") {
    throw new Error("DATABASE_SSL=true es obligatorio en producción.");
  }
  const secret = String(process.env.JWT_SECRET || "");
  if (Buffer.byteLength(secret, "utf8") < 32 || /^(REPLACE_|YOUR_|CHANGE_ME)/i.test(secret) || /^(.)\1+$/.test(secret)) {
    throw new Error("JWT_SECRET debe contener al menos 32 bytes aleatorios en producción.");
  }
}
module.exports = { assertProductionSecurity };

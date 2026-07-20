require("dotenv").config();

const bcrypt = require("bcryptjs");
const readline = require("node:readline/promises");
const { stdin, stdout } = require("node:process");
const pool = require("../src/config/database");

const MIN_PASSWORD_LENGTH = 8;
const BCRYPT_ROUNDS = 12;

function normalizeEmail(value) {
  return value.trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function readHidden(prompt) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    return rl.question(prompt).finally(() => rl.close());
  }

  return new Promise((resolve, reject) => {
    let value = "";

    const cleanup = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
    };

    const onData = (chunk) => {
      const key = chunk.toString("utf8");

      if (key === "\u0003") {
        cleanup();
        stdout.write("\n");
        reject(new Error("Operación cancelada."));
        return;
      }

      if (key === "\r" || key === "\n") {
        cleanup();
        stdout.write("\n");
        resolve(value);
        return;
      }

      if (key === "\u007f" || key === "\b") {
        if (value.length > 0) {
          value = value.slice(0, -1);
          stdout.write("\b \b");
        }
        return;
      }

      value += key;
      stdout.write("*");
    };

    stdout.write(prompt);
    stdin.setEncoding("utf8");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

async function main() {
  const rl = readline.createInterface({ input: stdin, output: stdout });

  try {
    console.log("\nCrear administrador de COINPSI\n");

    const fullName = (await rl.question("Nombre completo: ")).trim();
    const email = normalizeEmail(await rl.question("Correo: "));

    rl.close();

    if (fullName.length < 3) {
      throw new Error("El nombre debe tener al menos 3 caracteres.");
    }

    if (!isValidEmail(email)) {
      throw new Error("El correo no tiene un formato válido.");
    }

    const password = await readHidden(`Contraseña (mínimo ${MIN_PASSWORD_LENGTH} caracteres): `);
    const passwordConfirmation = await readHidden("Confirmar contraseña: ");

    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    }

    if (password !== passwordConfirmation) {
      throw new Error("Las contraseñas no coinciden.");
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const result = await pool.query(
      `
        INSERT INTO coinpsi.admin_users (
          full_name,
          email,
          password_hash,
          role,
          is_active
        )
        VALUES ($1, $2, $3, 'admin', TRUE)
        RETURNING id, full_name, email, role, is_active, created_at
      `,
      [fullName, email, passwordHash]
    );

    const admin = result.rows[0];

    console.log("\nAdministrador creado correctamente:");
    console.log(`ID: ${admin.id}`);
    console.log(`Nombre: ${admin.full_name}`);
    console.log(`Correo: ${admin.email}`);
    console.log(`Rol: ${admin.role}`);
    console.log(`Activo: ${admin.is_active ? "sí" : "no"}`);
  } catch (error) {
    if (error.code === "23505") {
      console.error("\nYa existe un administrador con ese correo.");
      process.exitCode = 1;
      return;
    }

    console.error(`\nNo se pudo crear el administrador: ${error.message}`);
    process.exitCode = 1;
  } finally {
    if (!rl.closed) {
      rl.close();
    }

    await pool.end();
  }
}

main();

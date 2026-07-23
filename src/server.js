const path = require("path");
const dotenv = require("dotenv");

const environment = process.env.NODE_ENV || "development";
const envFile = process.env.ENV_FILE || `.env.${environment}`;

dotenv.config({ path: path.resolve(process.cwd(), envFile) });
dotenv.config();

const app = require("./app");
const { getDatabaseHealth } = require("./services/health.service");

const PORT = process.env.PORT || 3002;

async function startServer() {
  try {
    const database = await getDatabaseHealth();

    console.log(
      `PostgreSQL conectado: ${database.name} | usuario: ${database.user} | esquema: ${database.schema}`
    );

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`COINPSI API corriendo en el puerto ${PORT}`);
    });
  } catch (error) {
    console.error("No se pudo iniciar COINPSI API porque PostgreSQL no esta disponible.");
    console.error(error.message);
    process.exitCode = 1;
  }
}

startServer();

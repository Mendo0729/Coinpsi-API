require("dotenv").config();

const app = require("./app");
const { getDatabaseHealth } = require("./services/health.service");

const PORT = process.env.PORT || 3002;

async function startServer() {
  try {
    const database = await getDatabaseHealth();

    console.log(
      `PostgreSQL conectado: ${database.name} | usuario: ${database.user} | esquema: ${database.schema}`
    );

    app.listen(PORT, () => {
      console.log(`COINPSI API corriendo en http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("No se pudo iniciar COINPSI API porque PostgreSQL no está disponible.");
    console.error(error.message);
    process.exitCode = 1;
  }
}

startServer();

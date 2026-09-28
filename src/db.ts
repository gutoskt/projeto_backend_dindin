import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost")
    ? false
    : { rejectUnauthorized: false },
});

const aguardarBanco = async (maxTentativas = 30, delayMs = 1000) => {
  for (let tentativa = 1; tentativa <= maxTentativas; tentativa += 1) {
    try {
      const client = await pool.connect();
      client.release();
      return;
    } catch (error) {
      if (tentativa === maxTentativas) {
        throw error;
      }

      console.warn(
        `Banco ainda não disponível (tentativa ${tentativa}/${maxTentativas}). Aguardando ${delayMs}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
};

export const prepararBanco = async () => {
  await aguardarBanco();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS dindin (
      id SERIAL PRIMARY KEY,
      nomedindin VARCHAR(255) NOT NULL,
      quantidadesabor INTEGER NOT NULL DEFAULT 0,
      cor VARCHAR(7) NOT NULL DEFAULT '#1D6B5B',
      receita TEXT NOT NULL DEFAULT ''
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS dindin_mes (
      id SERIAL PRIMARY KEY,
      dindin_id INTEGER NOT NULL REFERENCES dindin(id) ON DELETE CASCADE,
      entradas INTEGER NOT NULL DEFAULT 0,
      saidas INTEGER NOT NULL DEFAULT 0,
      mes_ano TIMESTAMPTZ NOT NULL DEFAULT CURRENT_DATE
    );
  `);

  await pool.query(`
    ALTER TABLE dindin
    ADD COLUMN IF NOT EXISTS cor VARCHAR(7) NOT NULL DEFAULT '#1D6B5B';
    ALTER TABLE dindin
    ADD COLUMN IF NOT EXISTS receita TEXT NOT NULL DEFAULT '';
  `);

  console.log("Conectado ao PostgreSQL com TypeScript!");
};

export default pool;
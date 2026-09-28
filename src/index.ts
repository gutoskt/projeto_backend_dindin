import cors from "cors";
import express from "express";
import { prepararBanco } from "./db";
import dindinRoutes from "./routes/dindin.routes";

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Registra as rotas da API sob o prefixo /api
app.use("/api", dindinRoutes);

// Inicia o Servidor
prepararBanco()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor TypeScript rodando na porta ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Não foi possível preparar o banco de dados:", error);
    process.exit(1);
  });

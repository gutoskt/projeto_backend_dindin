import { Router } from "express";
import {
  adicionarEntrada,
  adicionarSaida,
  apagarSabor,
  cadastrarSabor,
  calcularTotalSabor,
  confirmDindinOrder,
  editarQuantidade,
  editarSabor,
  listarHistoricoPorMes,
  listarReceitas,
  listarSabores,
  salvarReceita,
  updateDindinQuantity,
} from "../controllers/dindin.controller";

const router = Router();

router.post("/novo-sabor", cadastrarSabor);
router.delete("/dindin/:id", apagarSabor);
router.post("/calcular-total", calcularTotalSabor);
router.get("/sabores", listarSabores);
router.get("/receitas", listarReceitas);
router.put("/receitas/:id", salvarReceita);
router.put("/editarSabor/:id", editarSabor);
router.patch("/editarQuantidade/:id", editarQuantidade);
router.patch("/adcionar-sentrada/:id", adicionarEntrada);
router.patch("/adicionar-entrada/:id", adicionarEntrada);
router.patch("/adicionar-saida/:id", adicionarSaida);
router.get("/historico-por-mes", listarHistoricoPorMes);
router.patch("/dindin/:id/quantidade", updateDindinQuantity);
router.post("/dindin/pedido", confirmDindinOrder);

export default router;

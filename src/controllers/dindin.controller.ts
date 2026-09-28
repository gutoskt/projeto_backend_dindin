import type { Request, Response } from "express";
import pool from "../db";

const CUSTO_UNITARIO = 1.0;
const PRECO_VENDA = 2.0;
const COR_PADRAO = "#1D6B5B";

export interface DindinRow {
  id: number;
  nomedindin: string;
  quantidadesabor: number;
  cor: string;
  receita: string;
}

interface UserParams {
  id: string;
}

interface CadastrarSaborBody {
  nomedindin: string;
  quantidadesabor: number;
  cor?: string;
}

interface PatchQuantidadeBody {
  quantidadesabor?: number;
}

interface MovimentacaoBody {
  entradas?: number;
  saidas?: number;
}

interface ReceitaBody {
  receita: string;
}

class OrderError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "OrderError";
  }
}

export const cadastrarSabor = async (req: Request, res: Response) => {
  let client;
  try {
    const {
      nomedindin,
      quantidadesabor,
      cor = COR_PADRAO,
    } = req.body as CadastrarSaborBody;

    if (
      !nomedindin?.trim() ||
      typeof quantidadesabor !== "number" ||
      quantidadesabor < 0 ||
      !/^#[0-9A-Fa-f]{6}$/.test(cor)
    ) {
      return res.status(400).json({
        mensagem:
          "Envie um nome válido e uma quantidade maior ou igual a zero.",
      });
    }

    const queryText = `
      INSERT INTO dindin (nomedindin, quantidadesabor, cor) 
      VALUES ($1, $2, $3) 
      RETURNING *;
    `;

    client = await pool.connect();
    await client.query("BEGIN");
    const result = await client.query<DindinRow>(queryText, [
      nomedindin.trim(),
      quantidadesabor,
      cor,
    ]);

    if (quantidadesabor > 0) {
      await client.query(
        `
          INSERT INTO dindin_mes (dindin_id, entradas, saidas, mes_ano)
          VALUES ($1, $2, 0, DATE_TRUNC('month', CURRENT_DATE))
          RETURNING *;
        `,
        [result.rows[0].id, quantidadesabor],
      );
    }

    await client.query("COMMIT");
    return res.status(201).json({
      mensagem: "Sabor cadastrado com sucesso!",
      dindin: result.rows[0],
    });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    console.error("Erro ao cadastrar novo sabor:", error);
    return res.status(500).json({
      mensagem: "Erro interno ao salvar no banco de dados.",
      detalhe: error instanceof Error ? error.message : "Erro desconhecido.",
    });
  } finally {
    client?.release();
  }
};

export const apagarSabor = async (req: Request<UserParams>, res: Response) => {
  let client;
  try {
    const numId = Number(req.params.id);
    if (isNaN(numId)) return res.status(400).json({ mensagem: "ID inválido." });

    client = await pool.connect();
    await client.query("BEGIN");

    const historico = await client.query(
      "DELETE FROM dindin_mes WHERE dindin_id = $1;",
      [numId],
    );
    const result = await client.query<DindinRow>(
      "DELETE FROM dindin WHERE id = $1 RETURNING *;",
      [numId],
    );

    if (result.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ mensagem: "Dindin não encontrado." });
    }

    await client.query("COMMIT");

    return res.status(200).json({
      mensagem: "Sabor apagado com sucesso!",
      apagado: result.rows[0],
      historicoRemovido: historico.rowCount,
    });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    console.error("Erro ao apagar dindin:", error);
    return res.status(500).json({
      mensagem: "Erro interno ao apagar no banco de dados.",
      detalhe: error instanceof Error ? error.message : "Erro desconhecido.",
    });
  } finally {
    client?.release();
  }
};

export const calcularTotalSabor = async (_req: Request, res: Response) => {
  try {
    const queryText = `
      SELECT 
        COALESCE(SUM(entradas), 0)::INTEGER AS total_entradas_mes,
        COALESCE(SUM(saidas), 0)::INTEGER AS total_saida_mes
      FROM dindin_mes
      WHERE mes_ano = DATE_TRUNC('month', CURRENT_DATE);
    `;

    const result = await pool.query(queryText);
    const entrada = Number(result.rows[0].total_entradas_mes);
    const saida = Number(result.rows[0].total_saida_mes);

    const custototalMes = saida * CUSTO_UNITARIO;
    const faturamentoMes = saida * PRECO_VENDA;
    const lucroMes = saida * (PRECO_VENDA - CUSTO_UNITARIO);

    return res.status(200).json({
      totalMes: entrada,
      totalEntradasMes: entrada,
      totalSaidasMes: saida,
      custoMes: custototalMes,
      lucroMes: lucroMes,
      faturamentoMes: faturamentoMes,
    });
  } catch (error) {
    console.error("Erro ao calcular total:", error);
    return res
      .status(500)
      .json({ mensagem: "Erro interno ao calcular totais." });
  }
};

export const listarSabores = async (_req: Request, res: Response) => {
  try {
    const queryText = "SELECT * FROM dindin ORDER BY id ASC;";
    const result = await pool.query<DindinRow>(queryText);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar sabores:", error);
    return res
      .status(500)
      .json({ mensagem: "Erro interno ao buscar sabores no banco de dados." });
  }
};

export const listarReceitas = async (_req: Request, res: Response) => {
  try {
    const result = await pool.query<
      Pick<DindinRow, "id" | "nomedindin" | "cor" | "receita">
    >("SELECT id, nomedindin, cor, receita FROM dindin ORDER BY id ASC;");
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar receitas:", error);
    return res.status(500).json({
      mensagem: "Erro interno ao buscar receitas.",
      detalhe: error instanceof Error ? error.message : "Erro desconhecido.",
    });
  }
};

export const salvarReceita = async (
  req: Request<UserParams, any, ReceitaBody>,
  res: Response,
) => {
  const numId = Number(req.params.id);
  const { receita } = req.body;

  if (isNaN(numId)) return res.status(400).json({ mensagem: "ID inválido." });
  if (typeof receita !== "string") {
    return res.status(400).json({ mensagem: "A receita deve ser um texto." });
  }

  try {
    const result = await pool.query<
      Pick<DindinRow, "id" | "nomedindin" | "cor" | "receita">
    >(
      `
        UPDATE dindin
        SET receita = $1
        WHERE id = $2
        RETURNING id, nomedindin, cor, receita;
      `,
      [receita.trim(), numId],
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ mensagem: "Sabor não encontrado." });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Erro ao salvar receita:", error);
    return res.status(500).json({
      mensagem: "Erro interno ao salvar receita.",
      detalhe: error instanceof Error ? error.message : "Erro desconhecido.",
    });
  }
};

export const editarSabor = async (
  req: Request<UserParams, any, CadastrarSaborBody>,
  res: Response,
) => {
  const numId = Number(req.params.id);
  const { nomedindin, quantidadesabor, cor = COR_PADRAO } = req.body;

  if (isNaN(numId)) return res.status(400).json({ mensagem: "ID inválido." });
  if (
    !nomedindin?.trim() ||
    typeof quantidadesabor !== "number" ||
    quantidadesabor < 0 ||
    !/^#[0-9A-Fa-f]{6}$/.test(cor)
  ) {
    return res
      .status(400)
      .json({ mensagem: "Nome e quantidade são obrigatórios." });
  }

  try {
    const queryText = `
      UPDATE dindin
      SET nomedindin = $1, quantidadesabor = $2, cor = $3
      WHERE id = $4
      RETURNING id, nomedindin, quantidadesabor, cor;
    `;

    const result = await pool.query<DindinRow>(queryText, [
      nomedindin.trim(),
      quantidadesabor,
      cor,
      numId,
    ]);
    if (result.rowCount === 0) {
      return res.status(404).json({ mensagem: "Sabor não encontrado." });
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Erro na query PUT:", error);
    return res.status(500).json({
      mensagem: "Erro interno ao editar o sabor.",
      detalhe: error instanceof Error ? error.message : "Erro desconhecido.",
    });
  }
};

export const editarQuantidade = async (
  req: Request<UserParams, any, PatchQuantidadeBody>,
  res: Response,
) => {
  const numId = Number(req.params.id);
  const { quantidadesabor } = req.body;

  if (isNaN(numId)) return res.status(400).json({ mensagem: "ID inválido." });
  if (typeof quantidadesabor !== "number" || quantidadesabor < 0) {
    return res.status(400).json({
      mensagem: "A quantidade deve ser um número maior ou igual a zero.",
    });
  }

  try {
    const queryText = `
      UPDATE dindin
      SET quantidadesabor = $1
      WHERE id = $2
      RETURNING *;
    `;

    const result = await pool.query<DindinRow>(queryText, [
      quantidadesabor,
      numId,
    ]);
    if (result.rowCount === 0) {
      return res.status(404).json({ mensagem: "Sabor não encontrado." });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Erro na rota PATCH:", error);
    return res.status(500).json({ mensagem: "Erro interno no servidor." });
  }
};

export const adicionarEntrada = async (
  req: Request<UserParams, any, MovimentacaoBody>,
  res: Response,
) => {
  const numId = Number(req.params.id);
  const { entradas } = req.body;

  if (isNaN(numId)) return res.status(400).json({ mensagem: "ID inválido." });
  if (typeof entradas !== "number" || entradas <= 0) {
    return res.status(400).json({
      mensagem:
        "Envie uma quantidade de entradas válida (número maior que zero).",
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const queryEstoque = `
      UPDATE dindin
      SET quantidadesabor = quantidadesabor + $1
      WHERE id = $2
      RETURNING *;
    `;
    const estoqueResult = await client.query<DindinRow>(queryEstoque, [
      entradas,
      numId,
    ]);

    if (estoqueResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({ mensagem: "Sabor de dindin não encontrado." });
    }

    const historicoExistente = await client.query(
      `
        UPDATE dindin_mes
        SET entradas = entradas + $1
        WHERE dindin_id = $2 AND mes_ano = DATE_TRUNC('month', CURRENT_DATE)
        RETURNING *;
      `,
      [entradas, numId],
    );
    const historicoResult = historicoExistente.rowCount
      ? historicoExistente
      : await client.query(
          `
            INSERT INTO dindin_mes (dindin_id, entradas, saidas, mes_ano)
            VALUES ($1, $2, 0, DATE_TRUNC('month', CURRENT_DATE))
            RETURNING *;
          `,
          [numId, entradas],
        );

    await client.query("COMMIT");

    return res.status(200).json({
      mensagem: "Entrada registrada e estoque atualizado com sucesso!",
      historico: historicoResult.rows[0],
      dindinAtualizado: estoqueResult.rows[0],
    });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    console.error("Erro ao adicionar entrada:", error);
    return res.status(500).json({
      mensagem: "Erro interno no servidor ao registrar entrada.",
      detalhe: error instanceof Error ? error.message : "Erro desconhecido.",
    });
  } finally {
    client?.release();
  }
};

export const adicionarSaida = async (
  req: Request<UserParams, any, MovimentacaoBody>,
  res: Response,
) => {
  const numId = Number(req.params.id);
  const { saidas } = req.body;

  if (isNaN(numId)) return res.status(400).json({ mensagem: "ID inválido." });
  if (typeof saidas !== "number" || saidas <= 0) {
    return res.status(400).json({
      mensagem:
        "Envie uma quantidade de saídas válida (número maior que zero).",
    });
  }

  let client;

  try {
    client = await pool.connect();
    await client.query("BEGIN");

    const updateEstoqueQuery = `
      UPDATE dindin
      SET quantidadesabor = quantidadesabor - $1
      WHERE id = $2 AND quantidadesabor >= $1
      RETURNING *;
    `;
    const estoqueAtualizado = await client.query<DindinRow>(
      updateEstoqueQuery,
      [saidas, numId],
    );

    if (estoqueAtualizado.rowCount === 0) {
      const checkExists = await client.query<{ quantidadesabor: number }>(
        "SELECT quantidadesabor FROM dindin WHERE id = $1",
        [numId],
      );
      await client.query("ROLLBACK");

      if (checkExists.rowCount === 0) {
        return res
          .status(404)
          .json({ mensagem: "Sabor de dindin não encontrado." });
      }

      return res.status(400).json({
        mensagem: `Estoque insuficiente. Quantidade disponível: ${checkExists.rows[0].quantidadesabor}`,
      });
    }

    const historicoExistente = await client.query(
      `
        UPDATE dindin_mes
        SET saidas = saidas + $1
        WHERE dindin_id = $2 AND mes_ano = DATE_TRUNC('month', CURRENT_DATE)
        RETURNING *;
      `,
      [saidas, numId],
    );
    const historicoAtualizado = historicoExistente.rowCount
      ? historicoExistente
      : await client.query(
          `
            INSERT INTO dindin_mes (dindin_id, entradas, saidas, mes_ano)
            VALUES ($1, 0, $2, DATE_TRUNC('month', CURRENT_DATE))
            RETURNING *;
          `,
          [numId, saidas],
        );

    await client.query("COMMIT");

    return res.status(200).json({
      mensagem: "Saída registrada com sucesso!",
      dindinAtualizado: estoqueAtualizado.rows[0],
      historico: historicoAtualizado.rows[0],
    });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    console.error("Erro ao registrar saída:", error);
    return res.status(500).json({
      mensagem: "Erro interno no servidor ao registrar saída.",
      detalhe: error instanceof Error ? error.message : "Erro desconhecido.",
    });
  } finally {
    client?.release();
  }
};

export const listarHistoricoPorMes = async (_req: Request, res: Response) => {
  try {
    const queryText = `
      SELECT 
        TO_CHAR(dm.mes_ano, 'YYYY-MM-DD') AS mes_ano,
        SUM(dm.entradas)::INTEGER AS total_entradas_mes,
        SUM(dm.saidas)::INTEGER AS total_saidas_mes,
        (SUM(dm.saidas) * $1)::NUMERIC(10,2) AS custo_mes,
        (SUM(dm.saidas) * $2)::NUMERIC(10,2) AS faturamento_mes,
        (SUM(dm.saidas) * ($2 - $1))::NUMERIC(10,2) AS lucro_mes,
        COALESCE(
          json_agg(
            json_build_object(
              'dindin_id', d.id,
              'nomedindin', d.nomedindin,
              'entradas', dm.entradas,
              'saidas', dm.saidas
            )
          ), 
          '[]'::json
        ) AS sabores
      FROM dindin_mes dm
      INNER JOIN dindin d ON d.id = dm.dindin_id
      GROUP BY dm.mes_ano
      ORDER BY dm.mes_ano DESC;
    `;

    const result = await pool.query(queryText, [CUSTO_UNITARIO, PRECO_VENDA]);
    return res.status(200).json(result.rows);
  } catch (error) {
    console.error("Erro ao buscar histórico mensal:", error);
    return res.status(500).json({ mensagem: "Erro interno no servidor." });
  }
};

export const updateDindinQuantity = async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const { quantidadesabor } = req.body ?? {};

  if (!Number.isInteger(id) || id < 1) {
    return res.status(400).json({ error: "ID do sabor inválido" });
  }

  if (!Number.isInteger(quantidadesabor) || quantidadesabor < 0) {
    return res.status(400).json({
      error:
        "quantidadesabor deve ser um número inteiro igual ou maior que zero",
    });
  }

  try {
    const result = await pool.query(
      `UPDATE dindin
       SET quantidadesabor = $1
       WHERE id = $2
       RETURNING
         id,
         nomedindin AS sabor,
         quantidadesabor,
         cor,
         receita`,
      [quantidadesabor, id],
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Sabor não encontrado" });
    }

    return res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ error: "Erro ao atualizar quantidade do sabor" });
  }
};

export const confirmDindinOrder = async (req: Request, res: Response) => {
  const items = req.body?.items;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "O pedido não possui sabores" });
  }

  const quantities = new Map<number, number>();
  for (const item of items) {
    if (
      !item ||
      !Number.isInteger(item.id) ||
      item.id < 1 ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1
    ) {
      return res.status(400).json({
        error:
          "Cada sabor deve ter um ID válido e uma quantidade inteira maior que zero",
      });
    }

    quantities.set(item.id, (quantities.get(item.id) ?? 0) + item.quantity);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const updatedRecords = [];

    for (const [id, quantity] of [...quantities].sort(
      ([left], [right]) => left - right,
    )) {
      const stockResult = await client.query(
        `SELECT nomedindin AS sabor, quantidadesabor
         FROM dindin
         WHERE id = $1
         FOR UPDATE`,
        [id],
      );

      if (stockResult.rowCount === 0) {
        throw new OrderError(404, `O sabor de ID ${id} não foi encontrado`);
      }

      const availableQuantity = stockResult.rows[0].quantidadesabor ?? 0;
      if (availableQuantity < quantity) {
        throw new OrderError(
          409,
          `Estoque insuficiente para ${stockResult.rows[0].sabor}. Disponível: ${availableQuantity}.`,
        );
      }

      const result = await client.query(
        `UPDATE dindin
         SET quantidadesabor = quantidadesabor - $1
         WHERE id = $2
         RETURNING id, nomedindin AS sabor, quantidadesabor`,
        [quantity, id],
      );
      updatedRecords.push(result.rows[0]);
    }

    await client.query("COMMIT");
    return res.json({ updatedRecords });
  } catch (err) {
    await client.query("ROLLBACK");

    if (err instanceof OrderError) {
      return res.status(err.statusCode).json({ error: err.message });
    }

    console.error(err);
    return res
      .status(500)
      .json({ error: "Não foi possível confirmar o pedido" });
  } finally {
    client.release();
  }
};
# Dindin Backend

API REST para gerenciamento de sabores de dindin, receitas, estoque e movimentações mensais. O backend foi desenvolvido em TypeScript com Node.js e Express, utilizando PostgreSQL para persistência dos dados.

## Funcionalidades

- Cadastro, consulta, edição e remoção de sabores.
- Controle da quantidade disponível por sabor.
- Registro de entradas e saídas de estoque.
- Cadastro e consulta das receitas associadas aos sabores.
- Consulta de histórico e totais mensais, incluindo custo, faturamento e lucro estimados.
- Confirmação de pedidos com validação das quantidades disponíveis e atualização transacional do estoque.
- Preparação automática das tabelas ao iniciar a aplicação.

## Tecnologias

- **Node.js** para execução do servidor.
- **TypeScript** para implementação e tipagem do backend.
- **Express 5** para criação da API e definição das rotas.
- **PostgreSQL** como banco de dados relacional.
- **node-postgres (`pg`)** para conexão e consultas SQL.
- **Docker** para build e execução em contêiner.

## Arquitetura

O fluxo de uma requisição é:

```text
Cliente HTTP -> Express (CORS e JSON) -> Rotas /api -> Controladores -> PostgreSQL
```

As rotas encaminham as requisições aos controladores, onde ficam as validações e regras de negócio. Os controladores consultam o PostgreSQL por meio de um pool de conexões. As respostas da API são retornadas em JSON.

Na inicialização, a aplicação carrega as variáveis de ambiente, aguarda a conexão com o banco, cria ou ajusta as tabelas e então inicia o servidor. O banco é consultado por até 30 tentativas, com intervalo de um segundo entre elas.

## Modelo de dados

O banco possui duas tabelas relacionadas:

### `dindin`

Armazena os sabores e seus dados principais:

| Campo             | Descrição                        |
| ----------------- | -------------------------------- |
| `id`              | Identificador do sabor           |
| `nomedindin`      | Nome do sabor                    |
| `quantidadesabor` | Quantidade atualmente disponível |
| `cor`             | Cor associada ao sabor           |
| `receita`         | Texto da receita                 |

### `dindin_mes`

Armazena o total mensal de entradas e saídas por sabor:

| Campo       | Descrição                             |
| ----------- | ------------------------------------- |
| `id`        | Identificador do registro mensal      |
| `dindin_id` | Chave estrangeira para `dindin.id`    |
| `entradas`  | Total de unidades que entraram no mês |
| `saidas`    | Total de unidades que saíram no mês   |
| `mes_ano`   | Mês de referência                     |

O relacionamento entre `dindin_mes.dindin_id` e `dindin.id` associa o histórico ao sabor correspondente. O banco é preparado automaticamente pela aplicação; não é necessário executar um script de migração separado.

## Endpoints

Todas as rotas são prefixadas por `/api`. Os corpos das requisições com dados devem ser enviados em JSON.

| Método   | Endpoint                     | Descrição                                                                                           |
| -------- | ---------------------------- | --------------------------------------------------------------------------------------------------- |
| `POST`   | `/api/novo-sabor`            | Cadastra um sabor e, quando a quantidade inicial é maior que zero, registra a entrada no mês atual. |
| `GET`    | `/api/sabores`               | Lista os sabores.                                                                                   |
| `PUT`    | `/api/editarSabor/:id`       | Atualiza nome, quantidade e cor de um sabor.                                                        |
| `PATCH`  | `/api/editarQuantidade/:id`  | Define diretamente a quantidade em estoque.                                                         |
| `PATCH`  | `/api/dindin/:id/quantidade` | Outra rota para definir diretamente a quantidade em estoque.                                        |
| `DELETE` | `/api/dindin/:id`            | Remove um sabor e seu histórico.                                                                    |
| `POST`   | `/api/dindin/pedido`         | Confirma um pedido e desconta os itens do estoque numa transação.                                   |
| `PATCH`  | `/api/adicionar-entrada/:id` | Registra entrada e atualiza o estoque e o histórico mensal.                                         |
| `PATCH`  | `/api/adicionar-saida/:id`   | Registra saída, se houver estoque suficiente, e atualiza o histórico mensal.                        |
| `PATCH`  | `/api/adcionar-sentrada/:id` | Alias legado para registrar entrada.                                                                |
| `GET`    | `/api/receitas`              | Lista as receitas.                                                                                  |
| `PUT`    | `/api/receitas/:id`          | Salva ou atualiza a receita de um sabor.                                                            |
| `GET`    | `/api/historico-por-mes`     | Consulta o histórico agrupado por mês, com totais e valores calculados.                             |
| `POST`   | `/api/calcular-total`        | Retorna os totais de entradas e saídas e os valores calculados para o mês atual.                    |

### Exemplos de requisição

Cadastrar um sabor:

```http
POST /api/novo-sabor
Content-Type: application/json
```

```json
{
  "nomedindin": "Morango",
  "quantidadesabor": 20,
  "cor": "#D94F70"
}
```

Registrar uma entrada:

```http
PATCH /api/adicionar-entrada/1
Content-Type: application/json
```

```json
{
  "entradas": 10
}
```

Confirmar um pedido:

```http
POST /api/dindin/pedido
Content-Type: application/json
```

```json
{
  "items": [
    { "id": 1, "quantity": 2 },
    { "id": 2, "quantity": 1 }
  ]
}
```

## Executar localmente

### Pré-requisitos

- Node.js 20 ou superior.
- npm.
- Uma instância PostgreSQL acessível pelo backend.

### Instalação e configuração

1. Instale as dependências na pasta do backend:

   ```bash
   npm install
   ```

2. Crie um arquivo `.env` na raiz do projeto com a URL de conexão do PostgreSQL:

   ```env
   PORT=3000
   DATABASE_URL=postgresql://usuario:senha@localhost:5432/informacoesdindin
   ```

   Substitua usuário, senha, host, porta e nome do banco pelos dados do seu ambiente. O banco informado em `DATABASE_URL` deve existir antes de iniciar a API.

3. Inicie em modo de desenvolvimento:

   ```bash
   npm run dev
   ```

Quando a conexão e a preparação do banco forem concluídas, a API ficará disponível em `http://localhost:3000` (ou na porta definida por `PORT`).

### Build e execução compilada

```bash
npm run build
npm start
```

O comando de build compila os arquivos TypeScript de `src/` para `dist/`. O `.env` precisa estar disponível no diretório de execução também.

## Executar com Docker

Com o Docker instalado e um PostgreSQL acessível, construa a imagem na raiz do backend:

```bash
docker build -t dindin-backend .
```

Inicie o contêiner passando as variáveis de ambiente. Se o PostgreSQL estiver instalado na própria máquina Windows com Docker Desktop, use `host.docker.internal` como host em vez de `localhost`:

```bash
docker run --rm -p 3000:3000 `
	-e PORT=3000 `
	-e DATABASE_URL="postgresql://usuario:senha@host.docker.internal:5432/informacoesdindin" `
	dindin-backend
```

No PowerShell, o caractere de crase (`) no fim da linha permite quebrar o comando. Em outros terminais, adapte a quebra de linha ou execute o comando em uma única linha.

## Configuração do banco

O código lê a variável `DATABASE_URL`. O arquivo `.env.example` deste repositório ainda lista variáveis separadas (`DB_USER`, `DB_PASSWORD`, `DB_HOST`, `DB_PORT` e `DB_NAME`), que não são utilizadas diretamente pelo código atual. Para iniciar o backend, configure `DATABASE_URL` como mostrado acima.

## Observações

- O custo unitário e o preço de venda usados nos cálculos estão definidos no código como `1.00` e `2.00`, respectivamente. Ajuste esses valores no controlador caso a regra de negócio mude.
- A rota de entrada e saída atualiza o histórico mensal. A rota de confirmação de pedido atualiza o estoque, mas não registra essa saída em `dindin_mes`.
- O script `npm test` ainda é apenas um placeholder e termina com erro; não há testes automatizados configurados neste projeto.

## Estrutura do projeto

```text
src/
├── controllers/
│   └── dindin.controller.ts   # Validações e regras de negócio
├── routes/
│   └── dindin.routes.ts       # Endpoints da API
├── db.ts                      # Conexão e preparação do PostgreSQL
└── index.ts                   # Configuração e inicialização do Express
```

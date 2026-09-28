# 1. Sistema base leve com Node.js pré-instalado
FROM node:20-alpine

# 2. Pasta interna onde o projeto vai rodar no container
WORKDIR /usr/src/app

# 3. Copia a lista de dependências
COPY package*.json ./

# 4. Instala os pacotes do Node
RUN npm install

# 5. Copia os arquivos do backend (o .dockerignore bloqueia o .env aqui!)
COPY . .

# 6. Compila o TypeScript para JavaScript
RUN npm run build

# 7. Abre a porta de comunicação
EXPOSE 3000

# 8. Comando para ligar o servidor
CMD ["npm", "run", "start"]
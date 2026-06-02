FROM node:22-alpine

WORKDIR /app

RUN apk add --no-cache tini

# Copia dependências do projeto (raiz)
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Copia código do backend + Prisma
COPY server/src ./server/src
COPY server/tsconfig.json ./server/
COPY prisma ./prisma
COPY prisma.config.ts ./

# Gera Prisma Client
RUN npx prisma generate

EXPOSE 3001

ENV NODE_ENV=production

ENTRYPOINT ["tini", "--"]
CMD ["npx", "tsx", "server/src/index.ts"]

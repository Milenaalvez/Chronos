FROM node:22-alpine
RUN apk add --no-cache tini
WORKDIR /app

# Dependências
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# Prisma
COPY backend/prisma.config.ts ./backend/prisma.config.ts
COPY backend/prisma ./backend/prisma
RUN npx prisma generate --config=backend/prisma.config.ts

# Código do servidor
COPY backend/server ./backend/server

EXPOSE 3001
ENV NODE_ENV=production
ENTRYPOINT ["tini", "--"]
CMD ["npx", "tsx", "backend/server/src/index.ts"]

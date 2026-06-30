FROM node:20-alpine

RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml* ./

RUN pnpm install --config.store-dir=/app/node_modules/.pnpm-store

COPY . .

EXPOSE 5000

CMD ["pnpm", "run", "dev"]

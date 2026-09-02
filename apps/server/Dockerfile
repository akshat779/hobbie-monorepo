# Multi-stage Dockerfile for independent server deployment
FROM node:20-alpine AS base
WORKDIR /app

FROM base AS builder
# Copy root workspace configurations
COPY package.json tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY apps/server ./apps/server

# Install dependencies and build shared + server
RUN npm install
RUN npm run build:shared
RUN npm run build:server

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package.json ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["node", "apps/server/dist/index.js"]

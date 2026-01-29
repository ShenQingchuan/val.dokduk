# ========== 构建阶段 ==========
FROM node:24-alpine AS build-stage

WORKDIR /app
RUN corepack enable

COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY packages/ ./packages/

RUN --mount=type=cache,id=pnpm-store,target=/root/.pnpm-store \
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# ========== 生产阶段 ==========
FROM node:24-alpine AS production-stage

WORKDIR /app
RUN corepack enable

# 只安装生产依赖
COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY packages/ ./packages/

RUN --mount=type=cache,id=pnpm-store,target=/root/.pnpm-store \
    pnpm install --frozen-lockfile --prod --ignore-scripts

# 复制构建产物
COPY --from=build-stage /app/apps/server/dist ./apps/server/dist

# 复制 pm2 配置文件
COPY apps/server/ecosystem.config.json ./apps/server/

# 复制生产环境变量（由 Jenkins 在构建时注入）
COPY .env.production ./apps/server/.env

WORKDIR /app/apps/server

EXPOSE 3000

CMD ["pnpm", "start"]

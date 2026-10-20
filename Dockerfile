# syntax=docker/dockerfile:1

# Build stage: glibc image, because the TypeScript 7 compiler ships native binaries.
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
RUN npm ci --no-audit --no-fund
COPY src ./src
RUN npm run build \
 && find dist -name '*.test.js*' -delete \
 && rm -rf dist/testing

# Runtime stage: no third-party runtime dependencies, so only dist + package.json.
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=7000
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 7000
HEALTHCHECK --interval=60s --timeout=5s --start-period=60s \
  CMD wget -qO /dev/null "http://127.0.0.1:${PORT}/health" || exit 1
CMD ["node", "dist/index.js"]

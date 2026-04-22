# syntax=docker/dockerfile:1.7
#
# RealH API server — production image.
#
# Build context MUST be the repo root (so npm workspaces resolve correctly):
#   docker build -f packages/server/Dockerfile -t realh/server .
#
# The image does not bundle keys. In development, `keys/` is populated on first
# run via a mounted volume. In production, set KEY_MANAGER=kms and point it at
# your cloud KMS — see docs/SECURITY_ARCHITECTURE.md.

FROM node:25-alpine AS deps
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/server/package.json packages/server/package.json
# Install only the server workspace's production deps.
RUN npm ci --omit=dev --workspace=packages/server --include-workspace-root \
 && npm cache clean --force

FROM node:25-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001
# Non-root user for the runtime.
RUN addgroup -S realh && adduser -S realh -G realh -H -D
COPY --from=deps --chown=realh:realh /app/node_modules ./node_modules
COPY --from=deps --chown=realh:realh /app/package.json ./package.json
COPY --chown=realh:realh packages/server/package.json ./packages/server/package.json
COPY --chown=realh:realh packages/server/src ./packages/server/src
USER realh
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- "http://localhost:${PORT}/health" >/dev/null || exit 1
CMD ["node", "packages/server/src/index.js"]

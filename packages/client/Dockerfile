# syntax=docker/dockerfile:1.7
#
# RealH client — static SPA served by nginx.
#
# Build context MUST be the repo root:
#   docker build -f packages/client/Dockerfile -t realh/client .
#
# The client talks to the API over the URL baked in at build time via
# VITE_API_URL. Pass it as a build arg in production.

FROM node:20-alpine AS builder
WORKDIR /app
ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=${VITE_API_URL}
COPY package.json package-lock.json ./
COPY packages/client/package.json packages/client/package.json
RUN npm ci --workspace=packages/client --include-workspace-root
COPY packages/client ./packages/client
RUN npm run build -w packages/client

FROM nginx:1.27-alpine AS runner
# Drop the default nginx site; provide our SPA-aware config instead.
RUN rm /etc/nginx/conf.d/default.conf
COPY packages/client/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/packages/client/dist /usr/share/nginx/html
# nginx:alpine already runs workers as an unprivileged user; the master needs
# root to bind :80. If you need fully-rootless, switch to nginxinc/nginx-unprivileged.
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://localhost/ >/dev/null || exit 1

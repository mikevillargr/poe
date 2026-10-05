# Production image for Poe (Next.js standalone).
#
# Targets:
#   runner (default)  the app: `node server.js` on :3001, non-root, healthchecked
#   tools             one-off DB tooling (migrations, baseline marker); has the full
#                     node_modules incl. tsx. Used by the `migrate` compose service.
#
# Build:  docker build --build-arg GIT_SHA=$(git rev-parse HEAD) -t poe-app .
#
# Note: next.config.ts sets typescript.ignoreBuildErrors and eslint.ignoreDuringBuilds, so this
# build does NOT gate on type or lint errors. `npm run typecheck` / `npm run lint` (CI) are the gates.

FROM node:20-alpine AS base
# libc6-compat: some native/prebuilt binaries (e.g. Next's SWC) expect glibc symbols on Alpine.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ---- deps: full install (dev deps are needed for `next build` and tsx) ----------------------
FROM base AS deps
COPY package.json package-lock.json ./
# The lockfile references the vendored SheetJS tarball (file:vendor/xlsx-*.tgz).
COPY vendor ./vendor
RUN npm ci --no-audit --no-fund

# ---- tools: migrations and other one-off DB scripts -----------------------------------------
FROM base AS tools
ENV NODE_ENV=production
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json tsconfig.json ./
COPY --chown=node:node drizzle ./drizzle
COPY --chown=node:node scripts/db ./scripts/db
COPY --chown=node:node lib ./lib
USER node
# Override the command for other scripts, e.g. `npx tsx scripts/db/mark-baseline.ts`.
CMD ["npx", "tsx", "scripts/db/migrate.ts"]

# ---- builder: next build (standalone output) ------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# NEXT_PUBLIC_* values are inlined into the client bundle at build time (public values only).
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=""
ARG NEXT_PUBLIC_GOOGLE_API_KEY=""
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID \
    NEXT_PUBLIC_GOOGLE_API_KEY=$NEXT_PUBLIC_GOOGLE_API_KEY \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
RUN npm run build

# ---- runner: minimal production image -------------------------------------------------------
FROM base AS runner
ARG GIT_SHA=unknown
LABEL org.opencontainers.image.revision=$GIT_SHA \
      org.opencontainers.image.source="https://github.com/mikevillargr/poe" \
      command.app=poe
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3001 \
    HOSTNAME=0.0.0.0 \
    GIT_SHA=$GIT_SHA

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
RUN mkdir -p /app/uploads && chown node:node /app/uploads

USER node
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

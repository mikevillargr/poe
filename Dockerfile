# Production image for Poe (Next.js standalone).
#
# Targets:
#   runner (default)  the app: `node server.js` on :3001, non-root, healthchecked
#   tools             one-off DB tooling (migrations, baseline marker, universal seed) as bundled
#                     .cjs files in /app/dist, no node_modules. Used by the `migrate` compose service.
#
# Build:  docker build --build-arg GIT_SHA=$(git rev-parse HEAD) -t poe-app .
#
# Note: next.config.ts sets typescript.ignoreBuildErrors and eslint.ignoreDuringBuilds, so this
# build does NOT gate on type or lint errors. `npm run typecheck` / `npm run lint` (CI) are the gates.

FROM node:20-alpine AS base
# libc6-compat: some native/prebuilt binaries (e.g. Next's SWC) expect glibc symbols on Alpine.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ---- manifest: package.json with the release version blanked ---------------------------------
# scripts/release.js bumps "version" on every release. Feeding the raw package.json to `npm ci`
# would bust the dependency layer each time; this stage emits a copy that only changes when the
# dependencies do (COPY --from is keyed on content, so an identical output is a cache hit).
FROM base AS manifest
COPY package.json ./
RUN node -e "const p=require('./package.json');p.version='0.0.0';require('fs').writeFileSync('/tmp/package.json',JSON.stringify(p))"

# ---- deps: full install (dev deps are needed for `next build` and the tools bundle) ---------
FROM base AS deps
COPY --from=manifest /tmp/package.json ./package.json
COPY package-lock.json ./
# The lockfile references the vendored SheetJS tarball (file:vendor/xlsx-*.tgz).
COPY vendor ./vendor
RUN npm ci --no-audit --no-fund

# ---- tools-build: bundle the DB scripts into self-contained CommonJS files -------------------
# esbuild ships with tsx. Everything (drizzle-orm, pg, dotenv, lib/db/schema) is inlined, so the
# tools image needs no node_modules.
FROM deps AS tools-build
COPY tsconfig.json ./
COPY scripts/db ./scripts/db
COPY lib ./lib
RUN npx esbuild scripts/db/migrate.ts scripts/db/mark-baseline.ts scripts/db/seed-universal.ts scripts/db/seed-n8n.ts \
      --bundle --platform=node --target=node20 --format=cjs --outdir=dist --out-extension:.js=.cjs \
      --log-level=warning \
 && ls -l dist

# ---- tools: migrations and other one-off DB scripts (no node_modules) ------------------------
FROM node:20-alpine AS tools
ENV NODE_ENV=production
WORKDIR /app
COPY --from=tools-build --chown=node:node /app/dist ./dist
COPY --chown=node:node drizzle ./drizzle
USER node
# Override the command for other scripts, e.g. `node dist/mark-baseline.cjs`.
CMD ["node", "dist/migrate.cjs"]

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

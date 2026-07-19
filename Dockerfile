# syntax=docker/dockerfile:1
#
# Single-image deployment for the Real Estate CRM.
#
# The app is intentionally ONE origin: the API process serves the built SPA and
# the JSON API together, which is what keeps the httpOnly auth cookies working
# without CORS (see docs/DEPLOYMENT.md). So this image builds the web bundle and
# runs the API; there is nothing else to deploy.
#
# bookworm-slim (glibc) rather than alpine (musl) because @node-rs/argon2 ships
# prebuilt glibc binaries — no node-gyp, no build toolchain needed.

# ---- build stage: install everything, generate the Prisma client, build web --
FROM node:22-bookworm-slim AS build
WORKDIR /app

# Manifests first so the dependency layer caches across source-only changes.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

# --ignore-scripts: run install deterministically, then generate Prisma
# explicitly once the schema is present. Prisma 7 is a WASM query compiler, so
# no native engine download is needed.
RUN npm ci --ignore-scripts

COPY . .

RUN npm run db:generate -w @app/api \
 && npm run build -w @app/web

# ---- runtime stage -----------------------------------------------------------
# The API runs from TypeScript source via tsx (path aliases + @app/shared source
# + the generated .ts client make a bundle step more trouble than it's worth for
# this codebase). tsx is a production dependency, so it's present here. The
# Prisma CLI (a dev dependency) is kept so release migrations can run.
FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    SERVE_WEB=true \
    PORT=4000 \
    UPLOAD_DIR=/data/uploads

# Copy the fully-installed, fully-built tree. node_modules already contains tsx,
# the generated Prisma client, and apps/web/dist.
COPY --from=build /app ./

# Persistent media lives outside the image; mount a volume here in production.
RUN mkdir -p /data/uploads
VOLUME ["/data/uploads"]

EXPOSE 4000

# Node 22 has global fetch — no curl needed in the image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Apply pending migrations at release, then start. `migrate deploy` is
# idempotent and safe to run on every boot.
CMD ["sh", "-c", "npm run db:deploy -w @app/api && npm run start -w @app/api"]

# Build stage: needs the full repo present before `npm ci` runs, since the
# postinstall script (scripts/copy-wasm.mjs) copies sql.js's wasm into
# web/public/ — Vite then bundles that into dist/ during the build below.
FROM node:22-slim AS build
WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build

# Runtime stage: the server never imports sql.js (grading runs client-side,
# in the browser bundle already baked into dist/), so it only needs
# express/cors — --ignore-scripts skips the wasm-copy step, which isn't
# needed here and would fail anyway since scripts/ isn't copied in.
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY --from=build /app/dist ./dist
COPY server ./server
COPY problems ./problems

EXPOSE 3001
CMD ["node", "server/index.js"]

FROM node:24.18.0-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY apps/api apps/api
RUN npm run build -w @brocante/api

FROM node:24.18.0-bookworm-slim AS runtime

ENV NODE_ENV=production \
    HOME=/tmp \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app

COPY package.json package-lock.json .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev \
    && npx playwright install --with-deps chromium \
    && npm cache clean --force

COPY --from=build --chown=node:node /app/apps/api/dist apps/api/dist

USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["npm", "run", "start", "-w", "@brocante/api"]

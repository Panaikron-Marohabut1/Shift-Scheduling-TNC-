FROM node:24.18.1-bookworm-slim
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@11.25.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/auth/package.json apps/auth/package-lock.json apps/auth/
RUN pnpm install --frozen-lockfile && npm --prefix apps/auth ci
COPY apps/api/src apps/api/src
COPY apps/api/tsconfig.json apps/api/tsconfig.json
COPY apps/web apps/web
COPY apps/auth apps/auth
COPY scripts/copy-fonts.mjs scripts/copy-fonts.mjs
COPY config/certs config/certs
COPY deploy/pilot-gateway.mjs deploy/run-pilot.mjs deploy/
RUN pnpm build && npm --prefix apps/auth run build
ENV NODE_ENV=production
USER node
EXPOSE 8080
CMD ["node", "deploy/run-pilot.mjs"]

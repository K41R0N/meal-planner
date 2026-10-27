FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv ca-certificates && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/recipe-tools
ENV PATH="/opt/recipe-tools/bin:$PATH"
COPY server/requirements.txt ./server/requirements.txt
RUN pip install --no-cache-dir -r server/requirements.txt
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack pnpm install --frozen-lockfile
COPY tsconfig.json vite.config.ts ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
COPY server ./server
COPY tests ./tests
RUN corepack pnpm build
ENV NODE_ENV=production
ENV PORT=3000
# Online imports stay disabled until an approved production access policy is set.
ENV IMPORT_API_ENABLED=false
RUN chown -R node:node /app
USER node
EXPOSE 3000
CMD ["corepack", "pnpm", "start"]

# MCP server (Streamable HTTP) for Render or Fly. Reads and writes FalkorDB Cloud; needs no browser.
FROM node:24-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm i --no-save tsx
COPY packages ./packages
COPY tsconfig.json ./
ENV NODE_ENV=production PORT=8787
EXPOSE 8787
CMD ["npx", "tsx", "packages/mcp/server.ts", "--http"]

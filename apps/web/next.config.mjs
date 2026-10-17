// The API routes import packages/core and packages/mcp from the repository root and read packages/core/queries/*.cypher at run time.
// outputFileTracingRoot lets the build follow imports above apps/web; the include list ships the .cypher files with every API route.
import { fileURLToPath } from "node:url";
export default {
  reactStrictMode: true,
  experimental: { externalDir: true },
  serverExternalPackages: ["falkordb"],
  outputFileTracingRoot: fileURLToPath(new URL("../..", import.meta.url)),
  outputFileTracingIncludes: { "/api/**": ["../../packages/core/queries/**"] },
};

import { FalkorDB, type FalkorDBOptions, type Graph } from "falkordb";

export interface GraphScope {
  site: string;
  tenant?: string;
}

const SCOPE_PART = /^[a-z0-9][a-z0-9._-]*$/i;

function validateScopePart(value: string, name: string): string {
  if (!SCOPE_PART.test(value)) {
    throw new Error(`${name} must start with a letter or digit and contain only letters, digits, ".", "_" or "-"`);
  }
  return value;
}

export function graphName({ site, tenant }: GraphScope): string {
  const validSite = validateScopePart(site, "site");
  return tenant === undefined
    ? `public:${validSite}`
    : `tenant:${validateScopePart(tenant, "tenant")}:${validSite}`;
}

export function planGraphNames(scope: GraphScope): string[] {
  const publicName = graphName({ site: scope.site });
  return scope.tenant === undefined
    ? [publicName]
    : [graphName(scope), publicName];
}

export function selectGraph(db: Pick<FalkorDB, "selectGraph">, scope: GraphScope): Graph {
  return db.selectGraph(graphName(scope));
}

export function selectPlanGraphs(db: Pick<FalkorDB, "selectGraph">, scope: GraphScope): Graph[] {
  return planGraphNames(scope).map(name => db.selectGraph(name));
}

export function falkorOptions(env: NodeJS.ProcessEnv = process.env): FalkorDBOptions {
  if (env.FALKORDB_HOST) {
    const port = Number(env.FALKORDB_PORT || 6379);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("FALKORDB_PORT must be an integer between 1 and 65535");
    }
    if (env.FALKORDB_TLS !== undefined && !["true", "false"].includes(env.FALKORDB_TLS)) {
      throw new Error("FALKORDB_TLS must be 'true' or 'false'");
    }
    return {
      username: env.FALKORDB_USERNAME || "default",
      ...(env.FALKORDB_PASSWORD ? { password: env.FALKORDB_PASSWORD } : {}),
      socket: {
        host: env.FALKORDB_HOST,
        port,
        tls: env.FALKORDB_TLS === "true",
      },
    };
  }
  if (env.FALKORDB_URL) return { url: env.FALKORDB_URL };
  throw new Error("Set FALKORDB_URL or FALKORDB_HOST");
}

export async function connectFalkorDB(env: NodeJS.ProcessEnv = process.env): Promise<FalkorDB> {
  return FalkorDB.connect(falkorOptions(env));
}

// robots.txt (RFC 9309 subset): the agent never navigates to a path the site disallows for it (plan §3, rule 6).
export interface Robots { allows(url: string): boolean }

export const AGENT_NAME = "desirepath";

function ruleRegex(path: string): RegExp {
  const body = path.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp("^" + body.replace(/\\\$$/, "$"));
}

/** Rules of the most specific group naming us, else of `*`. Longest matching rule wins; Allow wins a tie. */
export function parseRobots(text: string, agent = AGENT_NAME): Robots {
  type Rule = { allow: boolean; re: RegExp; len: number };
  const groups: Array<{ agents: string[]; rules: Rule[] }> = [];
  let cur: { agents: string[]; rules: Rule[] } | undefined;
  let lastWasAgent = false;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const field = m[1].toLowerCase(), value = m[2].trim();
    if (field === "user-agent") {
      if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); }
      cur.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else if ((field === "allow" || field === "disallow") && cur) {
      lastWasAgent = false;
      if (value) cur.rules.push({ allow: field === "allow", re: ruleRegex(value), len: value.length });
    } else lastWasAgent = false;
  }
  const mine = groups.filter(g => g.agents.some(a => a !== "*" && agent.toLowerCase().includes(a)));
  const chosen = mine.length ? mine : groups.filter(g => g.agents.includes("*"));
  const rules = chosen.flatMap(g => g.rules);
  return {
    allows(url: string) {
      const u = new URL(url);
      const target = u.pathname + u.search;
      let best: Rule | undefined;
      for (const r of rules) {
        if (!r.re.test(target)) continue;
        if (!best || r.len > best.len || (r.len === best.len && r.allow)) best = r;
      }
      return best ? best.allow : true;
    },
  };
}

/** 2xx: parse. 4xx: no robots file, everything allowed. 5xx or network failure: throws, so the agent does not crawl blind. */
export async function fetchRobots(origin: string, fetchImpl: typeof fetch = fetch): Promise<Robots> {
  const res = await fetchImpl(new URL("/robots.txt", origin), { signal: AbortSignal.timeout(20_000) });
  if (res.status >= 500) throw new Error(`robots.txt at ${origin} answered ${res.status}`);
  if (!res.ok) return { allows: () => true };
  return parseRobots(await res.text());
}

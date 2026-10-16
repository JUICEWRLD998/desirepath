"""How much of a web task re-walks steps another task on the same site already took?  (plan §11)

Data: Mind2Web (Deng et al., 2023), CC-BY-4.0, https://huggingface.co/datasets/osunlp/Mind2Web
Only three small columns of the partial-train parquet files are read; no HTML.

Step      = normalised action ("[button] search -> click"); typed or selected values are masked.
Transition = (previous step, step), with a "<start>" marker before the first step.
Reuse of a task = share of its transitions that some OTHER task on the same site also contains.

Controls (a number without them proves nothing):
  1. a planted exact duplicate of a task must score 100 %
  2. the same measure against tasks of a DIFFERENT site must be near 0 %

    python scripts/measure_reuse.py                      # prints the numbers, exits 1 if a control fails
    python scripts/measure_reuse.py --export m2w.json    # also writes {site: [[step, ...], ...]} for pave_mind2web.ts
"""
import argparse, json, random, re, sys
import duckdb

URLS = [f"https://huggingface.co/datasets/osunlp/Mind2Web/resolve/refs%2Fconvert%2Fparquet/default/partial-train/{i:04d}.parquet" for i in range(8)]


def norm(action: str) -> str:
    action = re.sub(r"->\s*(TYPE|SELECT):.*$", r"-> \1", action)
    return re.sub(r"\s+", " ", action).strip().lower()


def load():
    con = duckdb.connect()
    con.execute("INSTALL httpfs; LOAD httpfs;")
    rows = []
    for url in URLS:
        rows += con.execute(f"SELECT website, confirmed_task, action_reprs FROM read_parquet('{url}')").fetchall()
    return [(site, task, ["<start>"] + [norm(a) for a in acts]) for site, task, acts in rows if acts]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--export", help="write the normalised tasks per site as JSON")
    args = ap.parse_args()

    tasks = load()
    by_site: dict[str, list[int]] = {}
    for i, (site, _, _) in enumerate(tasks):
        by_site.setdefault(site, []).append(i)
    print(f"tasks {len(tasks)}, sites {len(by_site)}")

    def transitions(steps):
        return [(steps[k], steps[k + 1]) for k in range(len(steps) - 1)]

    T = [set(transitions(s)) for (_, _, s) in tasks]

    def reuse(i, pool):
        seen = set()
        for j in pool:
            if j != i:
                seen |= T[j]
        tr = transitions(tasks[i][2])
        return sum(1 for x in tr if x in seen) / len(tr)

    same = [reuse(i, by_site[tasks[i][0]]) for i in range(len(tasks))]
    total_steps = sum(len(s) - 1 for (_, _, s) in tasks)
    walked = sum(round(r * (len(tasks[i][2]) - 1)) for i, r in enumerate(same))
    print(f"same-site: mean per-task reuse {100 * sum(same) / len(same):.1f}%, "
          f"steps already walked by another task {100 * walked / total_steps:.1f}% of {total_steps}")
    print(f"tasks with >=50% of steps already walked: {100 * sum(1 for r in same if r >= 0.5) / len(same):.1f}%")

    random.seed(1)
    sites = list(by_site)
    cross = [reuse(i, by_site[random.choice([s for s in sites if s != tasks[i][0]])]) for i in range(len(tasks))]
    cross_pct = 100 * sum(cross) / len(cross)
    print(f"control, cross-site: mean reuse {cross_pct:.1f}% (want near 0)")

    T.append(T[0]); tasks.append(tasks[0])
    planted_pct = 100 * reuse(0, [len(tasks) - 1])
    print(f"control, planted duplicate: {planted_pct:.1f}% (want 100)")
    T.pop(); tasks.pop()

    print("per site (top 8 by task count):")
    for site, idx in sorted(by_site.items(), key=lambda kv: -len(kv[1]))[:8]:
        print(f"  {site:<22} tasks {len(idx):>3}  mean reuse {100 * sum(same[i] for i in idx) / len(idx):5.1f}%")

    print("growth curve (k earlier tasks on the same site -> mean reuse):")
    random.seed(2)
    for k in [1, 2, 4, 8, 12, 16]:
        vals = []
        for idx in by_site.values():
            if len(idx) <= k:
                continue
            for _ in range(20):
                sample = random.sample(idx, k + 1)
                vals.append(reuse(sample[0], sample[1:]))
        print(f"  k={k:>2}: {100 * sum(vals) / len(vals):5.1f}%  (n={len(vals)})")

    if args.export:
        out: dict[str, list[list[str]]] = {}
        for site, _, steps in tasks:
            out.setdefault(site, []).append(steps[1:])
        with open(args.export, "w", encoding="utf8") as f:
            json.dump(out, f)
        print(f"wrote {args.export}")

    ok = planted_pct == 100.0 and cross_pct < 2.0
    if not ok:
        print("CONTROL FAILED: the numbers above cannot be trusted", file=sys.stderr)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())

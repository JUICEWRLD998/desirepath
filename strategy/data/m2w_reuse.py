# M2 probe on Mind2Web (CC-BY-4.0): how much of a web task re-walks steps another task on the same site
# already walked? Reads only 3 small columns from the remote parquet files (no HTML).
# Step = normalized action repr ("[button] Search -> CLICK"); typed/selected values are masked.
# Reuse of task t = fraction of its step-transitions (prev -> step) seen in some OTHER task on the same site.
# Controls: (1) a planted exact duplicate task must score 100%; (2) cross-site baseline: the same measure
# against tasks from a DIFFERENT site must be near 0%.
import re, sys, json, random
import duckdb

URLS = [f"https://huggingface.co/datasets/osunlp/Mind2Web/resolve/refs%2Fconvert%2Fparquet/default/partial-train/{i:04d}.parquet" for i in range(8)]
con = duckdb.connect()
con.execute("INSTALL httpfs; LOAD httpfs;")
rows = []
for u in URLS:
    rows += con.execute(f"SELECT website, confirmed_task, action_reprs FROM read_parquet('{u}')").fetchall()
print("tasks", len(rows), "sites", len({r[0] for r in rows}))

def norm(a):
    a = re.sub(r"->\s*(TYPE|SELECT):.*$", r"-> \1", a)
    a = re.sub(r"\s+", " ", a).strip().lower()
    return a

tasks = [(w, t, ["<start>"] + [norm(a) for a in acts]) for (w, t, acts) in rows if acts]
by_site = {}
for i, (w, t, s) in enumerate(tasks):
    by_site.setdefault(w, []).append(i)

def transitions(s):
    return {(s[k], s[k + 1]) for k in range(len(s) - 1)}

T = [transitions(s) for (_, _, s) in tasks]

def reuse(i, pool):
    seen = set()
    for j in pool:
        if j != i:
            seen |= T[j]
    tr = [(tasks[i][2][k], tasks[i][2][k + 1]) for k in range(len(tasks[i][2]) - 1)]
    return sum(1 for x in tr if x in seen) / len(tr)

same = [reuse(i, by_site[tasks[i][0]]) for i in range(len(tasks))]
steps = sum(len(s) - 1 for (_, _, s) in tasks)
walked = sum(round(r * (len(tasks[i][2]) - 1)) for i, r in enumerate(same))
print(f"same-site: mean per-task reuse {100*sum(same)/len(same):.1f}%, steps already walked by another task {100*walked/steps:.1f}% of {steps}")
print(f"tasks with >=50% of steps already walked: {100*sum(1 for r in same if r >= 0.5)/len(same):.1f}%")

# control 2: cross-site baseline (pool = tasks of a different random site of similar size)
random.seed(1)
sites = list(by_site)
cross = []
for i in range(len(tasks)):
    other = random.choice([s for s in sites if s != tasks[i][0]])
    cross.append(reuse(i, by_site[other]))
print(f"cross-site control: mean reuse {100*sum(cross)/len(cross):.1f}% (want near 0)")

# control 1: planted duplicate must score 100%
T.append(T[0]); tasks.append(tasks[0])
print(f"planted-duplicate control: {100*reuse(0, [len(tasks)-1]):.1f}% (want 100)")

# per-site table, top 8 by task count
top = sorted(by_site.items(), key=lambda kv: -len(kv[1]))[:8]
for w, idx in top:
    print(f"  {w:<22} tasks {len(idx):>3}  mean reuse {100*sum(same[i] for i in idx)/len(idx):5.1f}%")

# growth curve: reuse of a task given k random earlier tasks on the same site
print("growth curve (k earlier tasks on same site -> mean reuse):")
random.seed(2)
for k in [1, 2, 4, 8, 12, 16]:
    vals = []
    for w, idx in by_site.items():
        if len(idx) <= k:
            continue
        for _ in range(20):
            sample = random.sample(idx, k + 1)
            vals.append(reuse(sample[0], sample[1:]))
    print(f"  k={k:>2}: {100*sum(vals)/len(vals):5.1f}%  (n={len(vals)})")

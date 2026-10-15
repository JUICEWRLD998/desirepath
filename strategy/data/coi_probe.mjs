// M2 probe: how many "similar-paper" reviewer suggestions are direct conflicts of interest?
// Naive suggester = authors of OpenAlex related_works (concept similarity), minus the paper's own authors.
// COI = candidate co-authored any work with any of the paper's authors in the 3 years up to publication.
// Positive control: an author of the paper itself must test as conflicted with a co-author.
const MAIL = 'fadhmusty@gmail.com';
const BASE = 'https://api.openalex.org';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let calls = 0;
async function get(path) {
  calls++;
  const url = `${BASE}${path}${path.includes('?') ? '&' : '?'}mailto=${MAIL}`;
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url);
    if (r.ok) return r.json();
    await sleep(1000 * (i + 1));
  }
  throw new Error('failed ' + url);
}
const short = (id) => id.replace('https://openalex.org/', '');

// coauthor set of an author over [y0, y1]
const coCache = new Map();
async function coauthors(aid, y0, y1) {
  const key = `${aid}:${y0}:${y1}`;
  if (coCache.has(key)) return coCache.get(key);
  const set = new Set();
  for (let page = 1; page <= 2; page++) {
    const j = await get(`/works?filter=author.id:${short(aid)},publication_year:${y0}-${y1}&select=id,authorships&per_page=200&page=${page}`);
    for (const w of j.results) for (const a of w.authorships || []) if (a.author?.id) set.add(a.author.id);
    await sleep(120);
    if (page * 200 >= j.meta.count) break;
  }
  set.delete(aid);
  coCache.set(key, set);
  return set;
}

const N = Number(process.argv[2] || 12);
const sample = await get(`/works?filter=publication_year:2024,type:article,authors_count:3-8,cited_by_count:>10&sample=${N}&seed=7&select=id,title,publication_year,authorships,related_works`);
let tot = 0, conf = 0, papers = 0, ctlOk = 0, ctlN = 0;
const rows = [];
for (const w of sample.results) {
  const authors = (w.authorships || []).map((a) => a.author?.id).filter(Boolean);
  if (authors.length < 2 || !(w.related_works || []).length) continue;
  const y = w.publication_year, y0 = y - 3;
  // positive control: author[1] must be in author[0]'s coauthor set
  const co0 = await coauthors(authors[0], y0, y);
  ctlN++; if (co0.has(authors[1])) ctlOk++;
  // naive candidates: authors of related works
  const rel = (w.related_works || []).slice(0, 10).map(short).join('|');
  const rj = await get(`/works?filter=openalex:${rel}&select=id,authorships&per_page=50`);
  const cands = [];
  for (const rw of rj.results) for (const a of rw.authorships || []) {
    const id = a.author?.id; if (id && !authors.includes(id) && !cands.includes(id)) cands.push(id);
  }
  const top = cands.slice(0, 10);
  // union of the paper authors' coauthor sets
  const union = new Set();
  for (const a of authors) for (const c of await coauthors(a, y0, y)) union.add(c);
  const hits = top.filter((c) => union.has(c));
  tot += top.length; conf += hits.length; papers++;
  rows.push(`${short(w.id)} | ${w.title?.slice(0, 60)} | authors ${authors.length} | candidates ${top.length} | direct COI ${hits.length}`);
}
console.log(rows.join('\n'));
console.log(`\npapers ${papers}, naive candidates ${tot}, direct-coauthor conflicts ${conf} (${tot ? ((100 * conf) / tot).toFixed(1) : 0}%)`);
console.log(`positive control (author1 in author0's coauthors): ${ctlOk}/${ctlN}`);
console.log(`API calls: ${calls}, date: ${new Date().toISOString()}`);

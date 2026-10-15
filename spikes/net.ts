// P0: which hosts can this machine reach? Prints status per host.
const hosts = [
  "https://books.toscrape.com/robots.txt",
  "https://quotes.toscrape.com/robots.txt",
  "https://openlibrary.org/robots.txt",
  "https://en.wikipedia.org/robots.txt",
  "https://openrouter.ai/api/v1/models",
  "https://huggingface.co/api/datasets/osunlp/Mind2Web",
];
for (const u of hosts) {
  try {
    const r = await fetch(u, { signal: AbortSignal.timeout(15000) });
    console.log(r.status, u);
  } catch (e) {
    console.log("FAIL", u, (e as Error).message);
  }
}

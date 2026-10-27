// Loads the word galaxy and does all the vector maths in the browser.
// Data: 6,000 common English words with 50-dimensional GloVe vectors,
// plus a 3D layout made with UMAP (see scripts/build_galaxy.py).

export interface Galaxy {
  words: string[];
  index: Map<string, number>;
  pos: Float32Array; // x, y, z per word, roughly in [-1, 1]
  group: Uint8Array; // colour group per word
  dims: number;
  vec: Float32Array; // unit-length vectors, n * dims
}

interface RawGalaxy {
  dims: number;
  words: string[];
  pos: number[];
  group: number[];
  scale: number[];
  vec: string; // base64 int8
}

export async function loadGalaxy(): Promise<Galaxy> {
  const raw: RawGalaxy = await fetch("/galaxy.json").then((r) => r.json());
  const n = raw.words.length;
  const d = raw.dims;

  const bin = atob(raw.vec);
  const vec = new Float32Array(n * d);
  for (let i = 0; i < n; i++) {
    let norm = 0;
    for (let j = 0; j < d; j++) {
      let q = bin.charCodeAt(i * d + j);
      if (q > 127) q -= 256;
      const v = (q / 127) * raw.scale[j];
      vec[i * d + j] = v;
      norm += v * v;
    }
    norm = Math.sqrt(norm) || 1;
    for (let j = 0; j < d; j++) vec[i * d + j] /= norm;
  }

  return {
    words: raw.words,
    index: new Map(raw.words.map((w, i) => [w, i])),
    pos: Float32Array.from(raw.pos),
    group: Uint8Array.from(raw.group),
    dims: d,
    vec,
  };
}

export interface Match {
  i: number;
  sim: number;
}

/** Closest words to a query vector by cosine similarity. */
export function nearestTo(g: Galaxy, q: Float32Array, k: number, exclude: Set<number>): Match[] {
  const d = g.dims;
  const out: Match[] = [];
  for (let i = 0; i < g.words.length; i++) {
    if (exclude.has(i)) continue;
    let s = 0;
    for (let j = 0; j < d; j++) s += g.vec[i * d + j] * q[j];
    if (out.length < k || s > out[out.length - 1].sim) {
      out.push({ i, sim: s });
      out.sort((a, b) => b.sim - a.sim);
      if (out.length > k) out.pop();
    }
  }
  return out;
}

function row(g: Galaxy, i: number) {
  return g.vec.subarray(i * g.dims, (i + 1) * g.dims);
}

export function neighbours(g: Galaxy, i: number, k = 8): Match[] {
  return nearestTo(g, row(g, i), k, new Set([i]));
}

/** a − b + c, e.g. king − man + woman ≈ queen */
export function analogy(g: Galaxy, a: number, b: number, c: number): Match[] {
  const q = new Float32Array(g.dims);
  const va = row(g, a), vb = row(g, b), vc = row(g, c);
  let norm = 0;
  for (let j = 0; j < g.dims; j++) {
    q[j] = va[j] - vb[j] + vc[j];
    norm += q[j] * q[j];
  }
  norm = Math.sqrt(norm) || 1;
  for (let j = 0; j < g.dims; j++) q[j] /= norm;
  return nearestTo(g, q, 4, new Set([a, b, c]));
}

/** Exact match, or words that start with the query. */
export function lookup(g: Galaxy, query: string): { i: number | null; suggestions: string[] } {
  const w = query.trim().toLowerCase();
  if (!w) return { i: null, suggestions: [] };
  const i = g.index.get(w);
  if (i !== undefined) return { i, suggestions: [] };
  return { i: null, suggestions: g.words.filter((x) => x.startsWith(w)).slice(0, 4) };
}

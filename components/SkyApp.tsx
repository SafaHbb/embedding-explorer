"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { analogy, loadGalaxy, lookup, neighbours, type Galaxy } from "@/lib/galaxy";
import { Sky, PALETTE, type Highlight } from "./Sky";

type Mode = "explore" | "analogy";

const TRY = ["ocean", "music", "coffee", "football", "computer", "happy"];
const PRESETS: [string, string, string][] = [
  ["king", "man", "woman"],
  ["paris", "france", "japan"],
  ["actor", "man", "woman"],
  ["summer", "hot", "cold"],
  ["doctor", "hospital", "school"],
];

const EASE = [0.22, 1, 0.36, 1] as const;

export default function SkyApp() {
  const [galaxy, setGalaxy] = useState<Galaxy | null>(null);
  const [mode, setMode] = useState<Mode>("explore");

  // explore
  const [query, setQuery] = useState("");
  const [focus, setFocus] = useState<number | null>(null);
  const [suggest, setSuggest] = useState<string[] | null>(null);

  // analogy
  const [abc, setAbc] = useState<[string, string, string]>(PRESETS[0]);

  useEffect(() => { loadGalaxy().then(setGalaxy); }, []);

  const near = useMemo(() => (galaxy && focus !== null ? neighbours(galaxy, focus, 8) : []), [galaxy, focus]);

  const ids = useMemo(() => abc.map((w) => galaxy?.index.get(w.trim().toLowerCase()) ?? -1), [abc, galaxy]);
  const result = useMemo(() => {
    if (!galaxy || ids.some((i) => i < 0)) return null;
    return analogy(galaxy, ids[0], ids[1], ids[2]);
  }, [galaxy, ids]);

  const highlight: Highlight = useMemo(() => {
    if (mode === "analogy" && result) {
      return {
        key: `an-${ids.join("-")}`,
        focus: null,
        neighbours: [],
        analogy: { a: ids[0], b: ids[1], c: ids[2], r: result[0].i },
      };
    }
    if (mode === "explore" && focus !== null) return { key: `ex-${focus}`, focus, neighbours: near, analogy: null };
    return { key: `none-${mode}`, focus: null, neighbours: [], analogy: null };
  }, [mode, result, ids, focus, near]);

  const search = (w: string) => {
    if (!galaxy) return;
    setQuery(w);
    const r = lookup(galaxy, w);
    setFocus(r.i);
    setSuggest(r.i === null ? r.suggestions : null);
  };

  const pick = (i: number) => {
    if (!galaxy) return;
    setMode("explore");
    setQuery(galaxy.words[i]);
    setSuggest(null);
    setFocus(i);
  };

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-space text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(60,70,120,0.22),transparent_65%)]" />

      {galaxy && <Sky galaxy={galaxy} highlight={highlight} onPick={pick} />}

      <AnimatePresence>
        {!galaxy && (
          <motion.div
            key="loading"
            exit={{ opacity: 0 }}
            className="absolute inset-0 grid place-items-center font-mono text-xs tracking-[0.2em] text-white/40"
          >
            <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.6, repeat: Infinity }}>
              MAPPING WORDS
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-4 p-4 sm:p-6">
        <div className="pointer-events-auto">
          <div className="flex items-center gap-2.5">
            <span className="relative grid h-7 w-7 place-items-center">
              <span className="absolute inset-0 rounded-full bg-glow/20 blur-md" />
              <span className="h-2 w-2 rounded-full bg-glow shadow-[0_0_12px_#FFD27A]" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">Semantic Sky</span>
          </div>
          <p className="mt-1 hidden pl-[38px] text-xs text-white/40 sm:block">6,000 words, placed by meaning</p>
          <p className="mt-0.5 hidden pl-[38px] text-xs text-white/25 sm:block">Drag to rotate · scroll to zoom</p>
        </div>

        <div className="pointer-events-auto flex rounded-full border border-white/10 bg-white/[0.04] p-1 backdrop-blur-md">
          {(["explore", "analogy"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className="relative rounded-full px-4 py-1.5 text-xs font-medium capitalize text-white/60 transition hover:text-white"
            >
              {mode === m && (
                <motion.span layoutId="mode" className="absolute inset-0 rounded-full bg-white/10" transition={{ duration: 0.4, ease: EASE }} />
              )}
              <span className={`relative ${mode === m ? "text-white" : ""}`}>{m}</span>
            </button>
          ))}
        </div>
      </header>

      {/* explore: search */}
      <AnimatePresence>
        {mode === "explore" && (
          <motion.div
            key="search"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-3 px-4"
          >
            <form
              onSubmit={(e) => { e.preventDefault(); search(query); }}
              className="flex w-full max-w-sm items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] py-1.5 pl-5 pr-1.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-md focus-within:border-white/25"
            >
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a word"
                aria-label="Word"
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-white/30"
              />
              <button className="rounded-full bg-white px-4 py-2 text-xs font-semibold text-space transition hover:bg-white/85">Find</button>
            </form>
            <div className="flex flex-wrap justify-center gap-1.5">
              {suggest !== null ? (
                suggest.length ? (
                  suggest.map((w) => <Chip key={w} onClick={() => search(w)}>{w}?</Chip>)
                ) : (
                  <span className="text-xs text-white/40">Not in this sky. Try another word.</span>
                )
              ) : (
                TRY.map((w) => <Chip key={w} onClick={() => search(w)}>{w}</Chip>)
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* explore: neighbour panel */}
      <AnimatePresence>
        {mode === "explore" && galaxy && focus !== null && (
          <motion.aside
            key={focus}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            transition={{ duration: 0.45, ease: EASE }}
            className="absolute right-4 top-20 hidden w-64 rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur-xl sm:right-6 sm:block"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[galaxy.group[focus] % PALETTE.length] }} />
                <span className="text-2xl font-semibold tracking-tight">{galaxy.words[focus]}</span>
              </div>
              <button onClick={() => { setFocus(null); setQuery(""); }} aria-label="Close" className="text-white/40 transition hover:text-white">✕</button>
            </div>
            <div className="mt-5 flex flex-col gap-2.5">
              {near.map((m, k) => (
                <motion.button
                  key={m.i}
                  onClick={() => pick(m.i)}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + k * 0.05 }}
                  className="group grid grid-cols-[1fr_72px] items-center gap-3 text-left"
                >
                  <span className="truncate text-sm text-white/75 transition group-hover:text-white">{galaxy.words[m.i]}</span>
                  <span className="h-1 overflow-hidden rounded-full bg-white/10">
                    <motion.span
                      className="block h-full rounded-full bg-[#9EC5FF]"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(0, m.sim) * 100}%` }}
                      transition={{ delay: 0.4 + k * 0.05, duration: 0.6, ease: EASE }}
                    />
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* analogy bar */}
      <AnimatePresence>
        {mode === "analogy" && (
          <motion.div
            key="analogy"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="absolute inset-x-0 bottom-6 flex flex-col items-center gap-3 px-4"
          >
            <div className="flex flex-wrap items-center justify-center gap-2 rounded-[28px] border border-white/10 bg-white/[0.05] px-3 py-2 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-md">
              <WordInput value={abc[0]} ok={ids[0] >= 0} onChange={(v) => setAbc([v, abc[1], abc[2]])} />
              <Op>−</Op>
              <WordInput value={abc[1]} ok={ids[1] >= 0} onChange={(v) => setAbc([abc[0], v, abc[2]])} />
              <Op>+</Op>
              <WordInput value={abc[2]} ok={ids[2] >= 0} onChange={(v) => setAbc([abc[0], abc[1], v])} />
              <Op>=</Op>
              <AnimatePresence mode="wait">
                <motion.span
                  key={result?.[0].i ?? "none"}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4, delay: 0.6, ease: EASE }}
                  className="min-w-[96px] rounded-full bg-glow px-4 py-2 text-center text-sm font-semibold text-space shadow-[0_0_28px_rgba(255,210,122,0.55)]"
                >
                  {result && galaxy ? galaxy.words[result[0].i] : "?"}
                </motion.span>
              </AnimatePresence>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {PRESETS.map((p) => (
                <Chip key={p.join()} active={p.join() === abc.join()} onClick={() => setAbc(p)}>
                  {p[0]} − {p[1]} + {p[2]}
                </Chip>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </main>
  );
}

function Chip({ children, onClick, active }: { children: React.ReactNode; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition ${
        active ? "border-white/30 bg-white/10 text-white" : "border-white/10 bg-white/[0.03] text-white/55 hover:border-white/25 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function Op({ children }: { children: React.ReactNode }) {
  return <span className="px-0.5 text-lg font-light text-white/40">{children}</span>;
}

function WordInput({ value, ok, onChange }: { value: string; ok: boolean; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Word"
      className={`w-[92px] rounded-full border bg-white/[0.04] px-3 py-2 text-center text-sm outline-none transition focus:border-white/30 ${
        ok ? "border-white/10 text-white" : "border-red-400/40 text-red-200"
      }`}
    />
  );
}

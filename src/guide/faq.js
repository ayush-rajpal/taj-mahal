import FAQ from '../../knowledge/faq.json'
import LEX from '../../knowledge/lexicon.json'

// The guidebook: answer common questions without any AI. Each entry in knowledge/faq.json has a
// question, a few other ways people ask it, and an answer written from the downloaded sources.
// Matching is BM25 over the questions, after folding synonyms together ("tall", "height", "high" are
// one word here, see knowledge/lexicon.json). backend/guidebook.py does exactly the same in Python.

const STOP = new Set(LEX.stop)
const IGNORE = new Set(LEX.ignore)
const PHRASES = LEX.phrases.map(([re, to]) => [new RegExp(re, 'g'), to])
export const SYNONYMS = LEX.synonyms // words that mean the same thing for our purposes -> one token

function stem(w) {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3)
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y'
  if (w.length > 4 && w.endsWith('es') && !w.endsWith('ses')) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1)
  return w
}

export function tokens(text) {
  let t = text.toLowerCase()
  for (const [re, to] of PHRASES) t = t.replace(re, to)
  t = t.replace(/[’']/g, '').replace(/[^a-z0-9\s]/g, ' ')
  const out = []
  for (const w of t.split(/\s+/)) {
    if (!w || STOP.has(w) || IGNORE.has(w)) continue
    out.push(SYNONYMS[w] ?? SYNONYMS[stem(w)] ?? stem(w))
  }
  return out
}

// ---- BM25 index over every way of asking each question -------------------------------------------
const K1 = 1.2
const B = 0.6
const docs = FAQ.map((f) => tokens([f.q, ...(f.alts ?? []), ...(f.tags ?? [])].join(' ')))
const avgLen = docs.reduce((s, d) => s + d.length, 0) / docs.length
const df = new Map()
for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1)
const idf = (t) => Math.log(1 + (docs.length - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5))

// a question asked exactly as written in the guidebook (or one of its other phrasings) always gets that entry
const exact = new Map()
const keyOf = (ts) => [...new Set(ts)].sort().join(' ')
for (const pass of ['q', 'alts']) {
  // main questions first, so an entry's own question beats another entry's alternate phrasing
  FAQ.forEach((f, i) => {
    for (const s of pass === 'q' ? [f.q] : f.alts ?? []) {
      const k = keyOf(tokens(s))
      if (k && !exact.has(k)) exact.set(k, i)
    }
  })
}

function score(q, i) {
  const d = docs[i]
  let s = 0
  for (const t of new Set(q)) {
    const tf = d.filter((x) => x === t).length
    if (!tf) continue
    s += (idf(t) * tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * d.length) / avgLen))
  }
  return s
}

// Returns { entry, confidence } for the best match, or null. confidence is the share of the
// question's meaning (idf-weighted words) the match covers; 0.62+ is a solid hit.
export function lookup(question) {
  const q = tokens(question)
  if (!q.length) return null
  if (!q.some((t) => df.has(t))) return null
  if (exact.has(keyOf(q))) return { entry: FAQ[exact.get(keyOf(q))], confidence: 1, score: Infinity }
  let best = -1
  let bs = 0
  for (let i = 0; i < docs.length; i++) {
    const s = score(q, i)
    if (s > bs) {
      bs = s
      best = i
    }
  }
  if (best < 0) return null
  // words the guidebook has never seen count a fixed amount: filler ("exactly") costs a little,
  // but a question about something else entirely ("Burj Khalifa") won't match
  const weight = (ts) => ts.reduce((s, t) => s + (df.has(t) ? idf(t) : UNKNOWN_WEIGHT), 0)
  const uq = [...new Set(q)]
  const confidence = weight(uq.filter((t) => docs[best].includes(t))) / (weight(uq) || 1)
  return { entry: FAQ[best], confidence, score: bs }
}

export const CONFIDENT = 0.62
const UNKNOWN_WEIGHT = 3.5

// a few good starter questions, one per topic
export function suggestions(n = 6, skip = new Set()) {
  const seen = new Set()
  const out = []
  for (const f of FAQ) {
    if (!f.starter || skip.has(f.q) || seen.has(f.topic)) continue
    seen.add(f.topic)
    out.push(f.q)
    if (out.length >= n) break
  }
  return out
}

export function related(question, n = 3) {
  const q = tokens(question)
  return FAQ.map((f, i) => [score(q, i), f.q])
    .filter(([s]) => s > 0)
    .sort((a, b) => b[0] - a[0])
    .slice(0, n)
    .map(([, q]) => q)
}

export const FAQ_COUNT = FAQ.length

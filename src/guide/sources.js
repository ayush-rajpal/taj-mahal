import { tokens } from './faq.js'

// When the guidebook has no answer, the guide looks it up in the Wikipedia and Wikivoyage articles
// saved with this world (public/guidebook/passages.json, built by tools/fetch_sources.py passages)
// and quotes the most relevant sentences, with a link to the article. All in the browser, no AI.

const K1 = 1.2
const B = 0.7
let index = null

async function load() {
  if (index) return index
  const r = await fetch(`${import.meta.env.BASE_URL}guidebook/passages.json`)
  const { articles, passages } = await r.json()
  const docs = passages.map((p) => tokens(`${articles[p.a].title} ${p.s} ${p.t}`))
  const df = new Map()
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1)
  const tf = docs.map((d) => {
    const m = new Map()
    for (const t of d) m.set(t, (m.get(t) ?? 0) + 1)
    return m
  })
  const avg = docs.reduce((s, d) => s + d.length, 0) / docs.length
  const idf = (t) => Math.log(1 + (docs.length - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5))
  index = { articles, passages, docs, tf, df, avg, idf }
  return index
}

function bm25(ix, q, i) {
  const tf = ix.tf[i]
  const len = ix.docs[i].length
  let s = 0
  for (const t of q) {
    const f = tf.get(t)
    if (f) s += (ix.idf(t) * f * (K1 + 1)) / (f + K1 * (1 - B + (B * len) / ix.avg))
  }
  return s
}

// the two or three sentences of a passage that best answer the question, in their original order
function excerpt(text, q, idf, max = 480) {
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) ?? [text]
  const scored = sentences.map((s, i) => {
    const ts = new Set(tokens(s))
    return { i, s: s.trim(), score: q.reduce((acc, t) => acc + (ts.has(t) ? idf(t) : 0), 0) }
  })
  const best = [...scored].sort((a, b) => b.score - a.score)[0]
  const pick = new Set([best.i])
  let len = best.s.length
  for (const j of [best.i + 1, best.i - 1, best.i + 2]) {
    if (scored[j] && len + scored[j].s.length < max) {
      pick.add(j)
      len += scored[j].s.length
    }
  }
  return [...pick]
    .sort((a, b) => a - b)
    .map((j) => scored[j].s)
    .join(' ')
}

// { title, url, site, section, text, confidence } for the best passage, or null
export async function searchSources(question) {
  const ix = await load()
  const q = [...new Set(tokens(question))]
  if (!q.length) return null
  let best = -1
  let bs = 0
  for (let i = 0; i < ix.passages.length; i++) {
    const s = bm25(ix, q, i) * ix.articles[ix.passages[i].a].w
    if (s > bs) {
      bs = s
      best = i
    }
  }
  if (best < 0) return null
  // how much of the question the passage covers (unknown words count, so "Burj Khalifa" won't match)
  const w = (t) => (ix.df.has(t) ? ix.idf(t) : 3)
  const covered = q.filter((t) => ix.tf[best].has(t))
  const confidence = covered.reduce((s, t) => s + w(t), 0) / q.reduce((s, t) => s + w(t), 0)
  const p = ix.passages[best]
  const a = ix.articles[p.a]
  const text = excerpt(p.t, q, ix.idf)
  // the words have to come together in the sentences we quote, not just somewhere in the passage
  const inQuote = new Set(tokens(`${a.title} ${text}`))
  const quoted = q.filter((t) => inQuote.has(t)).reduce((s, t) => s + w(t), 0) / q.reduce((s, t) => s + w(t), 0)
  return { title: a.title, url: a.url, site: a.site, section: p.s, text, confidence: Math.min(confidence, quoted), matched: covered.length }
}

export const SOURCE_CONFIDENT = 0.7

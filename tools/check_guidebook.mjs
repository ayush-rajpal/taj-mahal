// Ask the guide a list of questions, offline, exactly as the page does, and show what it answers.
//   node tools/check_guidebook.mjs
import { createServer } from 'vite'
import { readFileSync } from 'node:fs'

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' })
globalThis.fetch = async (url) => ({ json: async () => JSON.parse(readFileSync(`public/${String(url).replace(/^.*?guidebook\//, 'guidebook/')}`, 'utf8')) })
const { lookup, CONFIDENT } = await vite.ssrLoadModule('/src/guide/faq.js')
const { searchSources, SOURCE_CONFIDENT } = await vite.ssrLoadModule('/src/guide/sources.js')

// [question, expected guidebook id | 'wiki' (a quoted passage) | null (honest "don't know")]
const CASES = JSON.parse(readFileSync(new URL('./guidebook_cases.json', import.meta.url), 'utf8'))
let ok = 0
for (const [q, want] of CASES) {
  const hit = lookup(q)
  let got
  let note = hit ? `${hit.entry.id} ${hit.confidence.toFixed(2)}` : '-'
  if (hit && hit.confidence >= CONFIDENT) got = hit.entry.id
  else {
    const s = await searchSources(q)
    note += s ? ` | wiki ${s.title} ${s.confidence.toFixed(2)}` : ''
    got = s && s.confidence >= SOURCE_CONFIDENT ? 'wiki' : null
  }
  const pass = got === want
  ok += pass
  console.log(`${pass ? 'ok ' : 'XX '}${q.padEnd(58)} -> ${String(got).padEnd(18)} (${note})`)
}
console.log(`\n${ok}/${CASES.length} as expected`)
await vite.close()

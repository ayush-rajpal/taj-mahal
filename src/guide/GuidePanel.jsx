import { Fragment, useEffect, useRef, useState } from 'react'
import W from '../wonder.js'
import { EXITS, SPAWNS } from '../layout.js'
import { navigate } from '../mvw.js'
import { fadeOut, whoosh } from '../audio.js'
import { CONFIDENT, lookup, related, suggestions } from './faq.js'
import { SOURCE_CONFIDENT, searchSources } from './sources.js'

// The chat with Amanat. Everything is answered offline, in the browser, with no AI and no server:
//   1. the guidebook (knowledge/faq.json): hundreds of common questions with written answers;
//   2. otherwise, the most relevant sentences from the Wikipedia and Wikivoyage articles saved with
//      the world (public/guidebook/passages.json), quoted with a link to the article;
//   3. otherwise, an honest "not in my guidebook" and a few related questions it can answer.

const PLACES = [
  ['The Great Gate', 'great_gate'],
  ['Lotus pool', 'lotus_pool'],
  ['The great arch', 'taj_terrace'],
  ['Inside the tomb', 'inside_tomb'],
  ['Riverfront', 'riverfront'],
  ['The mosque', 'mosque'],
]

// tiny, safe formatting: **bold**, "- " bullets, clickable https:// links
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*|https:\/\/[^\s)]+[^\s).,:])/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <b key={i}>{part.slice(2, -2)}</b>
    if (part.startsWith('https://'))
      return (
        <a key={i} href={part} target="_blank" rel="noreferrer">
          {part.replace('https://', '').slice(0, 48)}
        </a>
      )
    return <Fragment key={i}>{part}</Fragment>
  })
}
function Rich({ text }) {
  const blocks = []
  for (const line of text.split('\n')) {
    const bullet = line.match(/^\s*[-•]\s+(.*)/)
    const last = blocks[blocks.length - 1]
    if (bullet) {
      if (last?.type === 'ul') last.items.push(bullet[1])
      else blocks.push({ type: 'ul', items: [bullet[1]] })
    } else if (line.trim()) blocks.push({ type: 'p', text: line })
  }
  return blocks.map((b, i) =>
    b.type === 'ul' ? (
      <ul key={i}>
        {b.items.map((it, j) => (
          <li key={j}>{inline(it)}</li>
        ))}
      </ul>
    ) : (
      <p key={i}>{inline(b.text)}</p>
    ),
  )
}

// each world you can portal to, once (several portals lead to Metaverse Square)
const DESTINATIONS = EXITS.filter((e, i) => EXITS.findIndex((o) => o.href === e.href) === i)

const BADGE = { guidebook: '📖 from the guidebook', wiki: '📚 quoted from the saved articles', none: '📖 guidebook' }

// kept while the page is open, so closing and reopening picks up where you were
let saved = null

export default function GuidePanel({ visitor, onClose, onTeleport }) {
  const [messages, setMessages] = useState(() => saved ?? [{ who: 'guide', text: W.greeting(visitor) }])
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const log = useRef()
  const input = useRef()
  useEffect(() => {
    saved = messages
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' })
  }, [messages, typing])
  useEffect(() => {
    const esc = (e) => e.code === 'Escape' && onClose()
    addEventListener('keydown', esc)
    setTimeout(() => input.current?.focus(), 50)
    return () => removeEventListener('keydown', esc)
  }, [onClose])

  const asked = new Set(messages.filter((m) => m.who === 'you').map((m) => m.text))
  const say = (m) => setMessages((ms) => [...ms, m])

  async function ask(text) {
    const q = text.trim().slice(0, 500)
    if (!q || typing) return
    setDraft('')
    say({ who: 'you', text: q })
    setTyping(true)
    const hit = lookup(q)
    await new Promise((r) => setTimeout(r, 400)) // a moment to "look it up"
    if (hit && hit.confidence >= CONFIDENT) {
      say({ who: 'guide', text: hit.entry.a, source: 'guidebook' })
      setTyping(false)
      return
    }
    let found = null
    try {
      found = await searchSources(q)
    } catch {
      found = null // the passages file didn't load; the guidebook still works
    }
    if (found && found.confidence >= SOURCE_CONFIDENT) {
      const where = found.site === 'Wikivoyage' ? 'Wikivoyage' : 'Wikipedia'
      say({
        who: 'guide',
        text: `That's not in my guidebook, but ${where}'s article on **${found.title}** says:

"${found.text}"

Read more: ${found.url}`,
        source: 'wiki',
        related: related(q),
      })
    } else if (hit && hit.confidence >= 0.5) {
      say({ who: 'guide', text: `I think you're asking: **${hit.entry.q}**

${hit.entry.a}`, source: 'guidebook', related: related(q) })
    } else {
      say({
        who: 'guide',
        text: "I'm sorry, that isn't in my guidebook. I only know about the Taj Mahal, the people who built it, Mughal Agra and visiting the site. Try asking another way, or one of these:",
        source: 'none',
        related: related(q, 4).length ? related(q, 4) : suggestions(4, asked),
      })
    }
    setTyping(false)
  }

  const go = (d) => {
    fadeOut()
    whoosh()
    navigate(d.href, d.spawn, d.back)
  }
  const starters = suggestions(6, asked)

  return (
    <div className="guide" role="dialog" aria-label={`Talking with ${W.guideName}`}>
      <header>
        <div className="guide-avatar">{W.guideIcon}</div>
        <div className="guide-title">
          {W.guideName}
          <span>{W.guideRole}</span>
        </div>
        <button className="guide-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <div className="guide-log" ref={log}>
        {messages.map((m, i) => (
          <div key={i} className={`guide-msg ${m.who === 'you' ? 'you' : 'tauhid'}`}>
            <Rich text={m.text} />
            {m.source && (
              <div className="guide-src">
                {BADGE[m.source] ?? m.source}
              </div>
            )}
            {m.related?.length > 0 && (
              <div className="guide-related">
                {m.related.map((q) => (
                  <button key={q} onClick={() => ask(q)}>
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {typing && <div className="guide-msg tauhid typing">…</div>}
        <div className="world-list">
          <p className="world-none">Want me to take you somewhere?</p>
          <div className="guide-places">
            {PLACES.map(([label, id]) => (
              <button key={id} onClick={() => onTeleport?.(SPAWNS[id])}>
                {label}
              </button>
            ))}
          </div>
          {DESTINATIONS.map((d) => (
            <div key={d.label} className="world-card ok">
              <div className="world-head">
                <span className="world-dot" />
                <b>{d.label}</b>
                <button onClick={() => go(d)}>Go →</button>
              </div>
              <span className="world-host">{d.sub}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="guide-asks">
        {starters.map((q) => (
          <button key={q} onClick={() => ask(q)} disabled={typing}>
            {q}
          </button>
        ))}
      </div>
      <form
        className="guide-input"
        onSubmit={(e) => {
          e.preventDefault()
          ask(draft)
        }}
      >
        <input ref={input} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Ask anything about the Taj Mahal…" maxLength={500} />
        <button type="submit" disabled={typing || !draft.trim()}>
          Ask
        </button>
      </form>
      <div className="guide-foot">All answers come from the guidebook and saved Wikipedia articles, no AI · {matchMedia('(pointer: coarse)').matches ? '× to keep exploring' : 'Esc to keep exploring'}</div>
    </div>
  )
}

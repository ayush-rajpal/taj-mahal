import { Fragment, useEffect, useRef, useState } from 'react'
import { GREETING, LESSONS } from './lessons.js'

// The chat window that opens when you talk to Tauhid. His lines are fixed (lessons.js): you pick a
// question, it shows up as your message, and his answer follows after a short "typing" pause.

// tiny, safe formatting: **bold**, `code`, "- " bullets, clickable https:// links
function inline(text) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`|https:\/\/[^\s)]+[^\s).,:])/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <b key={i}>{part.slice(2, -2)}</b>
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>
    if (part.startsWith('https://'))
      return (
        <a key={i} href={part} target="_blank" rel="noreferrer">
          {part.replace('https://', '')}
        </a>
      )
    return <Fragment key={i}>{part}</Fragment>
  })
}
function Rich({ text }) {
  const blocks = []
  for (const line of text.split('\n')) {
    const bullet = line.match(/^\s*-\s+(.*)/)
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

// the conversation is kept while the page is open, so closing and reopening picks up where you were
let saved = null

export default function GuidePanel({ visitor, onClose }) {
  const [messages, setMessages] = useState(() => saved ?? [{ who: 'tauhid', text: GREETING.replace("Yo!", visitor ? `Yo ${visitor}!` : 'Yo!') }])
  const [typing, setTyping] = useState(false)
  const log = useRef()
  useEffect(() => {
    saved = messages
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' })
  }, [messages, typing])
  useEffect(() => {
    const esc = (e) => e.code === 'Escape' && onClose()
    addEventListener('keydown', esc)
    return () => removeEventListener('keydown', esc)
  }, [onClose])

  const asked = new Set(messages.filter((m) => m.who === 'you').map((m) => m.text))
  const ask = (lesson) => {
    if (typing) return
    setMessages((m) => [...m, { who: 'you', text: lesson.q }])
    setTyping(true)
    setTimeout(() => {
      setMessages((m) => [...m, { who: 'tauhid', text: lesson.a }])
      setTyping(false)
    }, 650)
  }

  return (
    <div className="guide" role="dialog" aria-label="Talking with Tauhid Zaman">
      <header>
        <div className="guide-avatar">TZ</div>
        <div className="guide-title">
          Tauhid Zaman
          <span>your guide to the Metaverse Web</span>
        </div>
        <button className="guide-close" onClick={onClose} aria-label="Close">
          ×
        </button>
      </header>
      <div className="guide-log" ref={log}>
        {messages.map((m, i) => (
          <div key={i} className={`guide-msg ${m.who}`}>
            <Rich text={m.text} />
          </div>
        ))}
        {typing && <div className="guide-msg tauhid typing">…</div>}
      </div>
      <div className="guide-asks">
        {LESSONS.map((l) => (
          <button key={l.q} className={asked.has(l.q) ? 'asked' : ''} onClick={() => ask(l)} disabled={typing}>
            {l.q}
          </button>
        ))}
      </div>
      <div className="guide-foot">Click outside the chat, Esc or × to keep exploring</div>
    </div>
  )
}

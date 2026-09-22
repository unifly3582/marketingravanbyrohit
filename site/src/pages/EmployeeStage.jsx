import { useEffect, useRef, useState } from 'react'
import { AGENTS } from '../data/agents.js'
import './employee-stage.css'

/*
 * The WhatsApp page's hero, after Google's "personal Chrome" persona ad: the
 * copy on the left (passed in as children), and on the right one AI agent at
 * a time, a whole generated frame (the
 * card, the person, the floating assets, the name and the role), on a band
 * painted the frame's own page colour, filling the whole hero. Every HOLD
 * ms the frame turns away on its vertical axis and the next turns in, the
 * band crossfading to the next colour meanwhile — the reference's timing.
 *
 * Desktop shows each agent's landscape frame, phones the portrait one; an
 * agent that has only one shape shows it everywhere. Runs only while on
 * screen and the tab is visible; a dot jumps; hovering the frame holds.
 */
const HOLD = 1000 // ms a frame stays before turning
const OUT = 240 // ms for the frame to turn away
const IN = 340 // ms for the next to turn in

const useWide = () => {
  const [wide, setWide] = useState(() => matchMedia('(min-width: 768px)').matches)
  useEffect(() => {
    const mq = matchMedia('(min-width: 768px)')
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

export default function EmployeeStage({ children }) {
  const [i, setI] = useState(0)
  const [phase, setPhase] = useState('in') // 'in' | 'out'
  const [live, setLive] = useState(false) // on screen and tab visible
  const [paused, setPaused] = useState(false) // pointer over the frame
  const wide = useWide()
  const ref = useRef(null)
  const a = AGENTS[i]
  const frame = (wide ? a.wide : a.tall) || a.wide || a.tall
  const isWide = frame === a.wide

  // run only while the stage is in view and the tab is showing
  useEffect(() => {
    const el = ref.current
    let seen = false
    const update = () => setLive(seen && !document.hidden)
    const io = new IntersectionObserver(([en]) => { seen = en.isIntersecting; update() }, { threshold: 0.25 })
    io.observe(el)
    document.addEventListener('visibilitychange', update)
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', update) }
  }, [])

  // the next frames decode in the background so a turn never shows a blank
  useEffect(() => {
    AGENTS.forEach((x) => {
      const f = (wide ? x.wide : x.tall) || x.wide || x.tall
      const img = new Image()
      img.src = f.src
    })
  }, [wide])

  const go = (next) => {
    setPhase('out')
    setTimeout(() => {
      setI(next)
      setPhase('in')
    }, OUT)
  }

  useEffect(() => {
    if (!live || paused || phase !== 'in') return
    const t = setTimeout(() => go((i + 1) % AGENTS.length), HOLD)
    return () => clearTimeout(t)
  }, [i, phase, live, paused])

  return (
    <section
      ref={ref}
      className="es"
      style={{ '--tint': frame.page }}
      aria-label="The AI agents you can hire"
    >
      <div className="es-inner">
        <div className="es-copy">{children}</div>
        <div className="es-stage">
        <div
          className={`es-flip${isWide ? ' is-wide' : ' is-tall'}`}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <img
            key={a.key + (isWide ? '-w' : '-t')}
            className={`es-frame${phase === 'out' ? ' is-out' : ' is-in'}`}
            style={{ '--out': `${OUT}ms`, '--in': `${IN}ms` }}
            src={frame.src}
            alt={`${a.name}'s ${a.role}`}
            draggable="false"
          />
        </div>

        <div className="es-dots" role="tablist" aria-label="Agents">
          {AGENTS.map((x, k) => (
            <button
              key={x.key}
              type="button"
              role="tab"
              aria-selected={k === i}
              aria-label={`${x.name}'s ${x.role}`}
              className="es-dot"
              style={{ '--dot': x.dot }}
              onClick={() => { if (k !== i) go(k) }}
            />
          ))}
        </div>
        </div>
      </div>
    </section>
  )
}

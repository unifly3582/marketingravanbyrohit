import { useEffect, useRef, useState } from 'react'
import hospitality from '../../assets/website-concepts/hospitality.webp'
import skincare from '../../assets/website-concepts/skincare.webp'
import architecture from '../../assets/website-concepts/architecture.webp'
import './website-showcase.css'

const SCENES = [
  { image: hospitality, kind: 'Luxury hospitality', title: 'Stop the scroll.', accent: 'Make them feel it.', cue: 'Distinctive design', detail: 'An unforgettable first impression.', icon: 'spark', color: '#ffd292' },
  { image: skincare, kind: 'Beauty & ecommerce', title: 'Earn their trust.', accent: 'In every detail.', cue: 'Clarity builds confidence', detail: 'Your story. Your product. Beautifully clear.', icon: 'shield', color: '#ffb9c8' },
  { image: architecture, kind: 'Architecture & interiors', title: 'Be their first choice.', accent: 'Build brand value.', cue: 'A brand worth remembering', detail: 'A distinct identity visitors recognise.', icon: 'crown', color: '#e4f79b' },
]
// All three beats land within two seconds; hold the outcome before replaying.
const DURATIONS = [650, 650, 3700]

function StoryIcon({ kind }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'spark' ? <path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" /> : kind === 'shield' ? <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" /><path d="m8 12 3 3 5-6" /></> : <><path d="m3 7 4 12h10l4-12-6 4-3-7-3 7Z" /><path d="M7 22h10" /></>}
  </svg>
}

export default function WebsiteShowcase({ active }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [paused, setPaused] = useState(false)
  const [scene, setScene] = useState(0)
  const [pageVisible, setPageVisible] = useState(() => !document.hidden)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting && entry.intersectionRatio > .65), { threshold: [0, .65] })
    if (ref.current) observer.observe(ref.current)
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const onMotion = () => setReduced(media.matches)
    const onVisibility = () => setPageVisible(!document.hidden)
    media.addEventListener('change', onMotion)
    document.addEventListener('visibilitychange', onVisibility)
    return () => { observer.disconnect(); media.removeEventListener('change', onMotion); document.removeEventListener('visibilitychange', onVisibility) }
  }, [])
  const playing = active && visible && pageVisible && !paused && !reduced
  useEffect(() => {
    if (!active || !visible) setScene(0)
  }, [active, visible])
  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => setScene((i) => (i + 1) % SCENES.length), DURATIONS[scene])
    return () => clearTimeout(timer)
  }, [playing, scene])
  const story = SCENES[scene]
  return (
    <div ref={ref} className={`ws-story${playing ? ' is-playing' : ''}`} style={{ '--story-accent': story.color, '--story-duration': `${DURATIONS[scene]}ms` }}>
      <div className="ws-aura" aria-hidden="true" />
      <div className="ws-headline" key={`title-${scene}`}><strong>{story.title}</strong><em>{story.accent}</em></div>
      <div className="ws-gallery" aria-label="Premium website design concepts">
        {SCENES.map((item, i) => {
          const slot = (i - scene + SCENES.length) % SCENES.length
          return <div key={item.kind} className={`ws-screen slot-${slot}`} aria-hidden={slot !== 0}>
            <div className="ws-browserbar"><span>● ● ●</span><span>{item.kind}</span><span>↗</span></div>
            <img src={item.image} width="1536" height="1024" alt={`${item.kind} website concept`} draggable="false" />
          </div>
        })}
        <div className="ws-seal" key={`seal-${scene}`}><StoryIcon kind={story.icon} /><span>{story.cue}</span></div>
      </div>
      <div className="ws-story-footer">
        <p>{story.detail}</p>
        <div className="ws-controls">
          <div className="ws-scenes" aria-label="Choose a website concept">
            {SCENES.map((item, i) => <button key={item.kind} type="button" tabIndex={active ? 0 : -1} aria-label={`Show ${item.kind} concept`} aria-pressed={scene === i} onClick={() => { setScene(i); setPaused(true) }}><span>{['Attract', 'Build trust', 'Be remembered'][i]}</span><i key={`${scene}-${playing}`} /></button>)}
          </div>
          <button className="ws-pause" type="button" tabIndex={active ? 0 : -1} aria-label={paused || reduced ? 'Play website story' : 'Pause website story'} disabled={reduced} onClick={() => setPaused((p) => !p)}>{paused || reduced ? '▶' : 'Ⅱ'}</button>
        </div>
        <span className="ws-concept-note">DESIGN CONCEPTS · MADE TO INSPIRE YOUR BRAND</span>
      </div>
    </div>
  )
}

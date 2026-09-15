import { useEffect, useRef, useState } from 'react'
import beauty from '../../assets/meta-ad-concepts/beauty.webp'
import sneaker from '../../assets/meta-ad-concepts/sneaker.webp'
import travel from '../../assets/meta-ad-concepts/travel.webp'
import './meta-ads-showcase.css'

const ADS = [
  { image: beauty, brand: 'FORME', platform: 'instagram', cta: 'Shop now', alt: 'Premium skincare ad with a lavender serum bottle' },
  { image: sneaker, brand: 'STRIDE', platform: 'facebook', cta: 'Explore collection', alt: 'Cobalt blue sneaker ad with a floating lime and white shoe' },
  { image: travel, brand: 'SOLSTICE', platform: 'instagram', cta: 'Find your escape', alt: 'Boutique resort ad with a sunset infinity pool' },
]
const STORY = [
  { title: 'Win the scroll.', sub: 'Creative they stop for.', signal: 'That caught my eye.', icon: 'heart', stage: 'Attention' },
  { title: 'Turn looks into clicks.', sub: 'Give curiosity a direction.', signal: 'Let me take a look.', icon: 'cursor', stage: 'Interest' },
  { title: 'Start the conversation.', sub: 'Bring customers closer.', signal: 'Hi! Tell me more.', icon: 'chat', stage: 'Enquiry' },
]

function Platform({ name }) {
  return <span className={`ma-platform is-${name}`} aria-label={name === 'facebook' ? 'Facebook' : 'Instagram'}>
    {name === 'facebook' ? <b aria-hidden="true">f</b> : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17" cy="7" r="1" fill="currentColor" stroke="none" /></svg>}
  </span>
}

function SignalIcon({ kind }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'heart' ? <path d="M12 21 3.7 12.8C-2 6.8 6.5.3 12 6.6c5.5-6.3 14 0.2 8.3 6.2Z" /> : kind === 'cursor' ? <path d="m4 3 16 10-8 1-3 7Z" /> : <path d="M4 4h16v12H9l-5 4Z M8 8h8 M8 12h5" />}
  </svg>
}

export default function MetaAdsShowcase({ active }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  const [paused, setPaused] = useState(false)
  const [step, setStep] = useState(0)
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
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
    if (!playing) return
    const timer = setTimeout(() => setStep((n) => (n + 1) % STORY.length), 3400)
    return () => clearTimeout(timer)
  }, [playing, step])
  const scene = STORY[step]
  return <div ref={ref} className={`ma-story${playing ? ' is-playing' : ''}`}>
    <div className="ma-copy" key={step}><strong>{scene.title}</strong><span>{scene.sub}</span></div>
    <div className="ma-network"><Platform name="facebook" /><span>Facebook</span><i>+</i><Platform name="instagram" /><span>Instagram</span><small>FEED · STORIES · REELS</small></div>
    <div className="ma-feed" aria-label="Example Meta ad creatives">
      <div className="ma-track">
        {[...ADS, ...ADS].map((ad, i) => <div className="ma-ad" key={i} aria-hidden={i >= ADS.length}>
          <div className="ma-ad-head"><Platform name={ad.platform} /><span><b>{ad.brand}</b><small>Sponsored</small></span><i>···</i></div>
          <img src={ad.image} alt={ad.alt} width="1122" height="1402" draggable="false" />
          <div className="ma-ad-cta"><span>{ad.cta}</span><b>↗</b></div>
        </div>)}
      </div>
      <div className="ma-reactions" aria-hidden="true"><span>♥</span><span>♥</span><span>↗</span></div>
    </div>
    <div className="ma-signal" key={`signal-${step}`}><span className="ma-person" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4" /><path d="M4 22v-3a8 8 0 0 1 16 0v3Z" /></svg></span><span>{scene.signal}</span><SignalIcon kind={scene.icon} /></div>
    <div className="ma-footer">
      <div className="ma-journey" aria-label="Explore the customer journey">
        {STORY.map((item, i) => <button type="button" key={item.stage} aria-pressed={step === i} tabIndex={active ? 0 : -1} onClick={() => { setStep(i); setPaused(true) }}><SignalIcon kind={item.icon} /><span>{item.stage}</span></button>)}
        <button className="ma-pause" type="button" aria-label={paused || reduced ? 'Play Meta ads story' : 'Pause Meta ads story'} disabled={reduced} tabIndex={active ? 0 : -1} onClick={() => setPaused((p) => !p)}>{paused || reduced ? '▶' : 'Ⅱ'}</button>
      </div>
      <small>CAMPAIGN CONCEPTS · ILLUSTRATIVE CUSTOMER JOURNEY</small>
    </div>
  </div>
}

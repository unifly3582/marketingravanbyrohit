import { useEffect, useState } from 'react'
import beauty from '../../assets/meta-ad-concepts/beauty.webp'
import beauty160 from '../../assets/meta-ad-concepts/beauty-160.webp'
import beauty320 from '../../assets/meta-ad-concepts/beauty-320.webp'
import sneaker from '../../assets/meta-ad-concepts/sneaker.webp'
import sneaker160 from '../../assets/meta-ad-concepts/sneaker-160.webp'
import sneaker320 from '../../assets/meta-ad-concepts/sneaker-320.webp'
import travel from '../../assets/meta-ad-concepts/travel.webp'
import travel160 from '../../assets/meta-ad-concepts/travel-160.webp'
import travel320 from '../../assets/meta-ad-concepts/travel-320.webp'
import './meta-ads-showcase.css'

const ADS = [
  { image: beauty, srcSet: `${beauty160} 160w, ${beauty} 240w, ${beauty320} 320w`, brand: 'FORME', platform: 'instagram', cta: 'Shop now', alt: 'Premium skincare ad with a lavender serum bottle' },
  { image: sneaker, srcSet: `${sneaker160} 160w, ${sneaker} 240w, ${sneaker320} 320w`, brand: 'STRIDE', platform: 'facebook', cta: 'Explore collection', alt: 'Cobalt blue sneaker ad with a floating lime and white shoe' },
  { image: travel, srcSet: `${travel160} 160w, ${travel} 240w, ${travel320} 320w`, brand: 'SOLSTICE', platform: 'instagram', cta: 'Find your escape', alt: 'Boutique resort ad with a sunset infinity pool' },
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
  const [paused, setPaused] = useState(false)
  const [step, setStep] = useState(0)
  const [reduced, setReduced] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [pageVisible, setPageVisible] = useState(() => !document.hidden)
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)')
    const onMotion = () => setReduced(media.matches)
    const onVisibility = () => setPageVisible(!document.hidden)
    media.addEventListener('change', onMotion)
    document.addEventListener('visibilitychange', onVisibility)
    return () => { media.removeEventListener('change', onMotion); document.removeEventListener('visibilitychange', onVisibility) }
  }, [])
  // The stack supplies active only while this second card is at the front.
  const playing = active && pageVisible && !paused && !reduced
  useEffect(() => {
    if (!playing) return
    const timer = setTimeout(() => setStep((n) => (n + 1) % STORY.length), 3400)
    return () => clearTimeout(timer)
  }, [playing, step])
  const scene = STORY[step]
  return <div className={`ma-story${playing ? ' is-playing' : ''}`}>
    <div className="ma-copy" key={step}><strong>{scene.title}</strong><span>{scene.sub}</span></div>
    <div className="ma-network"><Platform name="facebook" /><span>Facebook</span><i>+</i><Platform name="instagram" /><span>Instagram</span><small>FEED · STORIES · REELS</small></div>
    <div className="ma-feed" aria-label="Example Meta ad creatives">
      <div className="ma-track">
        {[...ADS, ...ADS].map((ad, i) => <div className="ma-ad" key={i} aria-hidden={i >= ADS.length}>
          <div className="ma-ad-head"><Platform name={ad.platform} /><span><b>{ad.brand}</b><small>Sponsored</small></span><i>···</i></div>
          <img src={ad.image} srcSet={ad.srcSet} sizes="(min-width: 768px) 113px, 23vw" alt={ad.alt} width="240" height="300" draggable="false" loading="lazy" decoding="async" />
          <div className="ma-ad-cta"><span>{ad.cta}</span><b><svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-0.1em' }}><path d="M3 9 9 3M4 3h5v5" /></svg></b></div>
        </div>)}
      </div>
      <div className="ma-reactions" aria-hidden="true"><span><svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21 3.7 12.8C-2 6.8 6.5.3 12 6.6c5.5-6.3 14 0.2 8.3 6.2Z" /></svg></span><span><svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21 3.7 12.8C-2 6.8 6.5.3 12 6.6c5.5-6.3 14 0.2 8.3 6.2Z" /></svg></span><span><svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: '-0.1em' }}><path d="M3 9 9 3M4 3h5v5" /></svg></span></div>
    </div>
    <div className="ma-signal" key={`signal-${step}`}><span className="ma-person" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4" /><path d="M4 22v-3a8 8 0 0 1 16 0v3Z" /></svg></span><span>{scene.signal}</span><SignalIcon kind={scene.icon} /></div>
    <div className="ma-footer">
      <div className="ma-journey" aria-label="Explore the customer journey">
        {STORY.map((item, i) => <button type="button" key={item.stage} aria-pressed={step === i} tabIndex={active ? 0 : -1} onClick={() => { setStep(i); setPaused(true) }}><SignalIcon kind={item.icon} /><span>{item.stage}</span></button>)}
        <button className="ma-pause" type="button" aria-label={paused || reduced ? 'Play Meta ads story' : 'Pause Meta ads story'} disabled={reduced} tabIndex={active ? 0 : -1} onClick={() => setPaused((p) => !p)}>{paused || reduced ? <svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 12 12" fill="currentColor"><path d="M3 2l7 4-7 4z" /></svg> : <svg aria-hidden="true" width="1em" height="1em" viewBox="0 0 12 12" fill="currentColor"><path d="M3 2h2.4v8H3zM6.6 2H9v8H6.6z" /></svg>}</button>
      </div>
      <small>CAMPAIGN CONCEPTS · ILLUSTRATIVE CUSTOMER JOURNEY</small>
    </div>
  </div>
}

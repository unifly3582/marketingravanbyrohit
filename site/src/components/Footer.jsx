import logo from '../assets/logo-mark.png'

const SOCIALS = ['X.COM', 'LINKEDIN', 'INSTAGRAM', 'YOUTUBE'] // TODO: real URLs

export default function Footer() {
  return (
    <>
      {/* footer */}
      <footer className="border-t border-line bg-surface/80">
        <div className="container-x grid gap-10 py-16 md:grid-cols-[1.4fr_0.7fr]">
          <div>
            <div className="flex items-center gap-3">
              <img src={logo} alt="" className="h-14 w-auto" />
              <span className="font-display text-sm font-bold tracking-wide">
                MARKETING <span className="text-gold">RAVAN</span>
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
              The ten-headed growth engine. Agentic AI, smart ERP and
              next-generation digital marketing under one retainer.
            </p>
            <p className="mt-6 text-xs text-muted">
              info@marketingravan.com
            </p>
            <div className="mt-4 flex flex-wrap gap-4">
              {SOCIALS.map((s) => (
                <a
                  key={s}
                  href="#"
                  className="text-[0.62rem] font-bold uppercase tracking-[0.18em] text-muted transition-colors hover:text-gold"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Explore</h3>
            <ul className="mt-4 grid gap-2">
              {[['Home', '/'], ['Our services', '/#heads']].map(([label, href]) => (
                <li key={href}>
                  <a href={href} className="text-sm text-cream/75 transition-colors hover:text-gold">{label}</a>
                </li>
              ))}
            </ul>
          </div>

        </div>

        <div className="border-t border-line">
          <div className="container-x flex flex-wrap items-center justify-between gap-3 py-6 text-xs text-muted">
            <span>© 2026 Marketing Ravan. All ten heads reserved.</span>
            <span>Crafted by humans. Scaled by agents. 🔥</span>
          </div>
        </div>

        {/* giant wordmark */}
        {/* the wordmark, styled like the hero's: one line, MARKETING RAVAN
            a single space apart, gold fading to ember, tucked into the foot */}
        <div className="relative h-[clamp(2.2rem,8.5vw,10rem)] overflow-hidden" aria-hidden="true">
          <p className="pointer-events-none absolute -bottom-[0.2em] left-1/2 -translate-x-1/2 select-none whitespace-nowrap font-display text-[clamp(2rem,8.2vw,10rem)] font-extrabold leading-none tracking-[-0.045em]">
            <span className="bg-gradient-to-b from-gold/60 to-ember/25 bg-clip-text text-transparent">MARKETING RAVAN</span>
          </p>
        </div>
      </footer>
    </>
  )
}

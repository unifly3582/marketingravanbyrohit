import { HEADS } from '../data/heads.js'
import logo from '../assets/logo-mark.png'

const SOCIALS = ['X.COM', 'LINKEDIN', 'INSTAGRAM', 'YOUTUBE'] // TODO: real URLs

export default function Footer() {
  return (
    <>
      {/* footer */}
      <footer className="border-t border-line bg-surface/80">
        <div className="container-x grid gap-10 py-16 md:grid-cols-[1.4fr_0.7fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-3">
              <img src={logo} alt="" className="h-12 w-12 rounded-full object-cover object-top" />
              <span className="font-display text-sm font-bold tracking-wide">
                MARKETING <span className="text-gold">RAVAN</span>
              </span>
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted">
              The ten-headed growth engine. Agentic AI, smart ERP and
              next-generation digital marketing under one retainer.
            </p>
            <p className="mt-6 text-xs text-muted">
              hello@marketingravan.com
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
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Pages</h3>
            <ul className="mt-4 grid gap-2">
              {[['Works', '/works'], ['Aurora Case', '/case/aurora-robotics'], ['About', '/about'], ['Pricing', '/pricing'], ['Blog', '/blog'], ['Contact', '/contact']].map(([label, href]) => (
                <li key={href}>
                  <a href={href} className="text-sm text-cream/75 transition-colors hover:text-gold">{label}</a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted">The Ten Heads</h3>
            <ul className="mt-4 grid gap-2">
              {HEADS.slice(0, 5).map((h) => (
                <li key={h.n}>
                  <a href="/#heads" className="text-sm text-cream/75 transition-colors hover:text-gold">
                    {String(h.n).padStart(2, '0')} — {h.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted">&nbsp;</h3>
            <ul className="mt-4 grid gap-2">
              {HEADS.slice(5).map((h) => (
                <li key={h.n}>
                  <a href="/#heads" className="text-sm text-cream/75 transition-colors hover:text-gold">
                    {String(h.n).padStart(2, '0')} — {h.title}
                  </a>
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
        <div className="overflow-hidden pb-2" aria-hidden="true">
          <p className="select-none whitespace-nowrap text-center font-display text-[11.5vw] font-extrabold leading-[0.85] tracking-tight text-cream/[0.05]">
            marketing ravan
          </p>
        </div>
      </footer>
    </>
  )
}

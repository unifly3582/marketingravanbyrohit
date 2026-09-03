import sdr from '../assets/work-sdr.jpg'
import erp from '../assets/work-erp.jpg'
import bi from '../assets/work-bi.jpg'
import geo from '../assets/work-geo.jpg'
import mobile from '../assets/work-mobile.jpg'

const SHOTS = [
  [sdr, 'AI SDR console concept'],
  [erp, 'Smart ERP OCR pipeline concept'],
  [bi, 'Predictive BI dashboard concept'],
  [geo, 'GEO citation dashboard concept'],
  [mobile, 'Voice AI and ads mobile screens concept'],
]

export default function ImageMarquee() {
  return (
    <div className="mt-6 overflow-hidden" aria-hidden="true">
      <div className="marquee-track !gap-5" style={{ animationDuration: '48s' }}>
        {[0, 1].map((half) => (
          <div key={half} className="flex shrink-0 items-center gap-5">
            {SHOTS.map(([src, alt]) => (
              <div
                key={half + alt}
                className="w-[300px] shrink-0 overflow-hidden rounded-2xl border border-line md:w-[380px]"
              >
                <img src={src} alt={alt} loading="lazy" className="block aspect-video w-full object-cover" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

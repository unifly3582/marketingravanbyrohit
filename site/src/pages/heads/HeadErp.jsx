import { motion } from 'motion/react'
import HeadLayout from './HeadLayout.jsx'
import { usePlayer } from './usePlayer.js'
import { Check } from '../../components/icons.jsx'

/*
 * Head 05 — AI-Driven ERP & Supply Chain.
 * Demo: a photographed invoice gets scanned by an OCR beam; fields pop out
 * with confidence scores, then land as a ledger entry and stock movements.
 */

const FIELDS = [
  ['Vendor', 'Sharma Traders', 99],
  ['GSTIN', '24AABCS1234F1Z5', 98],
  ['Invoice #', 'ST/2026/0912', 99],
  ['Date', '02 Sep 2026', 99],
  ['Item', 'Cotton yarn 40s · 120 kg', 97],
  ['Item', 'Poly thread · 40 cones', 96],
  ['Taxable', '₹38,400', 99],
  ['GST 5%', '₹1,920', 99],
  ['Total', '₹40,320', 99],
]

const STOCK = [
  ['Cotton yarn 40s', 340, 460, 'kg'],
  ['Poly thread', 85, 125, 'cones'],
]

function ErpDemo() {
  const { ref, step, done } = usePlayer(8, { stepMs: 1400, pauseMs: 4500 })
  // 1: scanning  2..4: fields reveal  5: validated  6: ledger  7: stock  8: done
  const scanning = step >= 1 && step < 5
  const fieldsShown = step < 2 ? 0 : Math.min(FIELDS.length, (step - 1) * 3)
  const validated = step >= 5
  const ledger = step >= 6
  const stock = step >= 7

  return (
    <div ref={ref} className="grid gap-6 lg:grid-cols-[0.9fr_1.2fr]">
      {/* the invoice photo */}
      <div className="overflow-hidden rounded-3xl border border-line bg-card">
        <div className="flex items-center justify-between border-b border-line bg-card2 px-5 py-3.5">
          <p className="text-sm font-bold">invoice_sharma.jpg</p>
          <span className="text-[0.65rem] text-muted">from WhatsApp · 1.2 MB</span>
        </div>
        <div className="relative p-6">
          <div className="relative mx-auto max-w-[17rem] rotate-[-1.5deg] rounded-md bg-[#f4ecdc] p-5 text-[#2a1d12] shadow-[0_20px_50px_rgba(0,0,0,0.45)]">
            <p className="font-display text-sm font-extrabold tracking-wide">SHARMA TRADERS</p>
            <p className="text-[0.55rem] opacity-70">Ring Road, Surat · GSTIN 24AABCS1234F1Z5</p>
            <div className="mt-3 flex justify-between text-[0.6rem]">
              <span>Inv ST/2026/0912</span>
              <span>02-09-2026</span>
            </div>
            <div className="mt-3 border-t border-dashed border-[#2a1d12]/30 pt-2 text-[0.6rem]">
              {[
                ['Cotton yarn 40s', '120 kg', '30,000'],
                ['Poly thread', '40 cones', '8,400'],
              ].map(([n, q, a]) => (
                <div key={n} className="flex justify-between py-0.5">
                  <span className="w-1/2 truncate">{n}</span>
                  <span className="opacity-70">{q}</span>
                  <span>{a}</span>
                </div>
              ))}
            </div>
            <div className="mt-2 border-t border-[#2a1d12]/30 pt-2 text-[0.6rem]">
              <div className="flex justify-between"><span>Taxable</span><span>38,400</span></div>
              <div className="flex justify-between"><span>GST 5%</span><span>1,920</span></div>
              <div className="mt-1 flex justify-between font-bold"><span>TOTAL</span><span>₹40,320</span></div>
            </div>
            {/* scan beam */}
            {scanning && (
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 h-10"
                style={{ background: 'linear-gradient(180deg, transparent, rgba(240,163,47,0.55), transparent)' }}
                initial={{ top: '-10%' }}
                animate={{ top: ['-10%', '100%'] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
              />
            )}
            {validated && (
              <motion.div
                initial={{ scale: 0.6, opacity: 0, rotate: -12 }}
                animate={{ scale: 1, opacity: 1, rotate: -12 }}
                className="absolute -right-3 top-3 rounded-md border-2 border-[#1f8a4c] px-2 py-0.5 text-[0.6rem] font-extrabold uppercase tracking-[0.2em] text-[#1f8a4c]"
              >
                Verified
              </motion.div>
            )}
          </div>
          <p className="mt-5 text-center text-[0.72rem] text-muted">
            {step === 0 ? 'Waiting for a document…' : scanning ? 'Reading fields…' : validated && !done ? 'Posting…' : done ? 'Posted to books + inventory' : ''}
          </p>
        </div>
      </div>

      {/* extraction + ledger */}
      <div className="flex flex-col gap-6">
        <div className="rounded-3xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <p className="font-display text-xs font-extrabold tracking-[0.2em] text-gold">EXTRACTED</p>
            <p className="text-[0.65rem] text-muted">AI / OCR · confidence per field</p>
          </div>
          <div className="grid gap-x-6 gap-y-1.5 p-5 sm:grid-cols-2">
            {FIELDS.slice(0, fieldsShown).map(([k, v, c], i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center justify-between gap-3 border-b border-line py-1.5 text-[0.78rem]"
              >
                <span className="text-muted">{k}</span>
                <span className="truncate font-semibold text-cream/90">{v}</span>
                <span className={`shrink-0 text-[0.6rem] font-bold ${c >= 98 ? 'text-gold' : 'text-muted'}`}>{c}%</span>
              </motion.div>
            ))}
            {fieldsShown === 0 && <p className="text-[0.78rem] text-muted">—</p>}
          </div>
          {validated && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-2 border-t border-line px-5 py-3">
              {['GSTIN valid', 'PO #P-441 matched', 'No duplicate', 'Totals reconcile'].map((t) => (
                <span key={t} className="flex items-center gap-1.5 rounded-full bg-gold/10 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-gold">
                  <Check className="h-3 w-3" /> {t}
                </span>
              ))}
            </motion.div>
          )}
        </div>

        <div className="grid flex-1 gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-line bg-surface p-5">
            <p className="font-display text-xs font-extrabold tracking-[0.2em] text-gold">LEDGER</p>
            {ledger ? (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 space-y-2 text-[0.78rem]">
                <div className="flex justify-between border-b border-line pb-2">
                  <span className="text-muted">Purchases A/c</span>
                  <span className="font-semibold">Dr ₹38,400</span>
                </div>
                <div className="flex justify-between border-b border-line pb-2">
                  <span className="text-muted">Input GST</span>
                  <span className="font-semibold">Dr ₹1,920</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Sharma Traders</span>
                  <span className="font-semibold text-gold">Cr ₹40,320</span>
                </div>
                <p className="pt-1 text-[0.6rem] uppercase tracking-[0.14em] text-muted">Tally · voucher #2041 · due 02 Oct</p>
              </motion.div>
            ) : (
              <p className="mt-3 text-[0.78rem] text-muted">Awaiting validation…</p>
            )}
          </div>
          <div className="rounded-3xl border border-line bg-surface p-5">
            <p className="font-display text-xs font-extrabold tracking-[0.2em] text-gold">INVENTORY</p>
            <div className="mt-3 space-y-3">
              {STOCK.map(([n, from, to, u]) => (
                <div key={n} className="text-[0.78rem]">
                  <div className="flex justify-between">
                    <span className="text-muted">{n}</span>
                    <span className="font-semibold tabular-nums">
                      {stock ? (
                        <>
                          <span className="text-muted line-through">{from}</span> <span className="text-gold">{to}</span> {u}
                        </>
                      ) : (
                        <>{from} {u}</>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-card2">
                    <motion.div
                      className="h-full bg-gradient-to-r from-gold to-ember"
                      animate={{ width: `${((stock ? to : from) / 500) * 100}%` }}
                      transition={{ duration: 0.8 }}
                    />
                  </div>
                </div>
              ))}
              <p className="text-[0.6rem] uppercase tracking-[0.14em] text-muted">Godown A · Surat</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

const CONTENT = {
  n: 5,
  hero: {
    line1: 'Every receipt, PDF and invoice,',
    line2: 'in your books before lunch.',
    body:
      'A modern ERP with AI and OCR built in. Snap a receipt, forward a PDF, drop a photo on WhatsApp — the data lands in finance and inventory, verified against GST and your purchase orders, with no one typing a thing.',
    secondary: 'See a photo become an entry',
  },
  cta: { label: 'Book an ERP audit' },
  demo: {
    title: 'A photo on WhatsApp becomes a posted voucher.',
    body:
      'The supplier sends a picture of the invoice. Four seconds later it is read, verified, matched to its purchase order and posted — and your stock has moved with it.',
    node: <ErpDemo />,
  },
  jobs: {
    title: 'The paperwork the ERP head',
    titleMuted: 'takes over.',
    labels: ['Document', 'The pipeline'],
    items: [
      {
        title: 'Purchase invoices',
        trigger: 'Photos, PDFs and scans from suppliers',
        steps: 'OCR → GSTIN check → three-way match with PO and goods receipt → post payable',
        outcome: 'Payables always current',
      },
      {
        title: 'Sales & e-invoicing',
        trigger: 'An order confirmed',
        steps: 'Generate e-invoice with IRN → e-way bill → push to customer on WhatsApp and email',
        outcome: 'Compliant in one click',
      },
      {
        title: 'Inventory sync',
        trigger: 'Anything bought, made, moved or sold',
        steps: 'Update stock across godowns and channels → reorder alerts → dead-stock flags',
        outcome: 'One true stock number',
      },
      {
        title: 'GST reconciliation',
        trigger: 'Month end',
        steps: 'Match your purchases against GSTR-2B → surface mismatches → chase vendors automatically',
        outcome: 'Full input credit, no surprises',
      },
      {
        title: 'Expense claims',
        trigger: 'Staff send a receipt photo on WhatsApp',
        steps: 'Read → categorise → policy check → approve → reimburse via payout',
        outcome: 'Expenses closed same week',
      },
      {
        title: 'Vendor payables & aging',
        trigger: 'Dues approaching',
        steps: 'Aging report → payment run for approval → bank file → remittance advice to vendors',
        outcome: 'Pay on time, keep discounts',
      },
    ],
  },
  trust: {
    eyebrow: 'Accuracy you can audit',
    title: 'Trust the numbers,',
    titleMuted: 'check the trail.',
    body:
      'Automation in finance only works if you can prove every number. Our pipelines score their own confidence, ask a human when unsure and log the source of every figure.',
    items: [
      ['Confidence scoring', 'Every field carries a confidence. Below your threshold, it routes to a person for a two-second review instead of guessing.'],
      ['Three-way match', 'Invoice, purchase order and goods receipt are matched before anything posts. Mismatches surface, not disappear.'],
      ['Full audit trail', 'Source image, extracted values, who approved, when it posted. Your CA can trace every voucher to its photo.'],
    ],
  },
  stack: {
    title: 'Fits the books you keep.',
    body: 'We modernise around Tally or Zoho, or implement a full ERP — and connect banks, marketplaces and the GST portal either way.',
    tools: ['Tally', 'Zoho Books', 'Busy', 'Odoo', 'SAP Business One', 'GST portal', 'e-Invoice / IRP', 'Razorpay', 'Bank feeds', 'Shopify', 'Amazon Seller', 'Google Sheets'],
  },
  numbers: {
    items: [
      ['99.9%', 'field-level accuracy after validation'],
      ['4 sec', 'from photo to posted voucher'],
      ['0', 'hours of manual data entry'],
    ],
  },
  process: {
    title: 'From paper to a live ERP.',
    steps: [
      ['Process audit', 'We trace how a purchase, a sale and a stock move flow through your business today — and where the retyping happens.'],
      ['Configure + migrate', 'Set up or modernise the ERP, clean and migrate masters, connect banks and marketplaces.'],
      ['Train on your documents', 'The OCR pipeline learns your vendors\' formats — the smudged, the handwritten, the Gujarati-header ones.'],
      ['Go live + support', 'Parallel run for one cycle, then cut over. Monthly accuracy reports and new document types as you grow.'],
    ],
  },
}

export default function HeadErp() {
  return <HeadLayout {...CONTENT} />
}

import { useState } from 'react'
import { motion } from 'motion/react'
import { Arrow } from './icons.jsx'

export default function CallRequest() {
  const [phone, setPhone] = useState('')
  const [state, setState] = useState('idle') // idle | sending | done | error
  const [message, setMessage] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (state === 'sending') return
    setState('sending')
    setMessage('')
    try {
      const res = await fetch('/api/request-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong.')
      setState('done')
      setMessage('Calling you now — pick up!')
    } catch (err) {
      setState('error')
      setMessage(err.message)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="mt-5 rounded-3xl border border-line bg-card p-8 md:flex md:items-center md:justify-between md:gap-8"
    >
      <div className="max-w-md">
        <h3 className="text-xl font-bold">Get a call from our AI — right now</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Drop your number and our voice agent rings you back within seconds. Hear the tech we
          sell, live, on your own phone.
        </p>
      </div>

      {state === 'done' ? (
        <p className="mt-6 text-sm font-bold text-ember md:mt-0">{message}</p>
      ) : (
        <form onSubmit={submit} className="mt-6 flex w-full max-w-sm flex-col gap-3 md:mt-0">
          <div className="flex gap-3">
            <input
              type="tel"
              inputMode="numeric"
              placeholder="Your 10-digit mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              className="w-full rounded-full border border-line bg-surface px-5 py-3 text-sm outline-none placeholder:text-muted focus:border-ember"
            />
            <button type="submit" disabled={state === 'sending'} className="btn-primary shrink-0">
              {state === 'sending' ? 'Dialing…' : 'Call Me'} <Arrow className="h-4 w-4" />
            </button>
          </div>
          {state === 'error' && <p className="text-xs text-ember">{message}</p>}
          <p className="text-xs text-muted">Free demo call. No spam, ever.</p>
        </form>
      )}
    </motion.div>
  )
}

import { useState } from 'react'
import { motion } from 'motion/react'
import { Arrow } from './icons.jsx'
import { supabase } from '../lib/supabase.js'

export default function LeadForm() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [state, setState] = useState('idle') // idle | sending | done | error
  const [error, setError] = useState('')

  function update(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function submit(e) {
    e.preventDefault()
    if (state === 'sending') return
    if (!form.email && !form.phone) {
      setState('error')
      setError('Leave an email or a phone number so we can reach you.')
      return
    }
    setState('sending')
    setError('')
    const { error: dbError } = await supabase.from('leads').insert({
      name: form.name || null,
      email: form.email || null,
      phone: form.phone || null,
      message: form.message || null,
      source: 'website',
    })
    if (dbError) {
      setState('error')
      setError('Something went wrong — try WhatsApp or email instead.')
      return
    }
    setState('done')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay: 0.1 }}
      className="mt-5 rounded-3xl border border-line bg-card p-8"
    >
      {state === 'done' ? (
        <div className="py-6 text-center">
          <h3 className="text-xl font-bold">Got it. Ten heads are on it.</h3>
          <p className="mt-2 text-sm text-muted">
            We usually reply within the hour, on WhatsApp or email — whichever you left.
          </p>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="md:flex md:items-start md:justify-between md:gap-8">
            <div className="max-w-md">
              <h3 className="text-xl font-bold">Or just tell us here</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                A sentence is enough. It lands straight in our pipeline and a human (plus a few
                agents) picks it up.
              </p>
            </div>
            <div className="mt-6 flex w-full max-w-md flex-col gap-3 md:mt-0">
              <input
                type="text"
                placeholder="Your name"
                value={form.name}
                onChange={update('name')}
                className="w-full rounded-full border border-line bg-surface px-5 py-3 text-sm outline-none placeholder:text-muted focus:border-ember"
              />
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  placeholder="Email"
                  value={form.email}
                  onChange={update('email')}
                  className="w-full rounded-full border border-line bg-surface px-5 py-3 text-sm outline-none placeholder:text-muted focus:border-ember"
                />
                <input
                  type="tel"
                  placeholder="Phone / WhatsApp"
                  value={form.phone}
                  onChange={update('phone')}
                  className="w-full rounded-full border border-line bg-surface px-5 py-3 text-sm outline-none placeholder:text-muted focus:border-ember"
                />
              </div>
              <textarea
                rows={3}
                placeholder="What are you trying to automate?"
                value={form.message}
                onChange={update('message')}
                className="w-full rounded-3xl border border-line bg-surface px-5 py-3 text-sm outline-none placeholder:text-muted focus:border-ember"
              />
              <button
                type="submit"
                disabled={state === 'sending'}
                className="btn-primary justify-center disabled:opacity-60"
              >
                {state === 'sending' ? 'Sending…' : 'Send it'} <Arrow className="h-4 w-4" />
              </button>
              {state === 'error' && <p className="text-center text-xs text-ember">{error}</p>}
            </div>
          </div>
        </form>
      )}
    </motion.div>
  )
}

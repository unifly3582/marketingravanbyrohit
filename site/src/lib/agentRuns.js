import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from './supabase.js'

/** Stable identity for "no steps yet" — see the memo at the end of useAgentRun. */
const EMPTY_STEPS = []

/*
 * Live view of one agent run.
 *
 * The server writes agent_runs / agent_steps as the agent works; both tables are
 * in the Realtime publication and RLS exposes demo rows to the anon key, so the
 * browser can watch a run unfold without any websocket infrastructure of ours.
 *
 * Realtime can drop the first events if the subscription lands late, so we also
 * fetch current state once the channel is live and merge — whichever arrives
 * first wins, and steps are keyed by id so a duplicate is a no-op.
 */
export function useAgentRun(runId) {
  // State is tagged with the run it belongs to, and staleness is derived during
  // render. Resetting inside the effect instead would cascade an extra render
  // and briefly show the previous run's steps under the new id.
  const [state, setState] = useState({ id: null, run: null, steps: [], connected: false })
  const stepsRef = useRef(new Map())

  useEffect(() => {
    stepsRef.current = new Map()
    if (!runId) return

    let cancelled = false

    const mergeStep = (row) => {
      if (cancelled) return
      stepsRef.current.set(row.id, { ...stepsRef.current.get(row.id), ...row })
      const steps = [...stepsRef.current.values()].sort((a, b) => a.seq - b.seq)
      setState((prev) => ({ ...prev, id: runId, steps }))
    }

    const backfill = async () => {
      const [{ data: runRow }, { data: stepRows }] = await Promise.all([
        supabase.from('agent_runs').select('*').eq('id', runId).maybeSingle(),
        supabase.from('agent_steps').select('*').eq('run_id', runId).order('seq'),
      ])
      if (cancelled) return
      if (runRow) setState((prev) => ({ ...prev, id: runId, run: prev.run ?? runRow }))
      for (const row of stepRows ?? []) mergeStep(row)
    }

    const channel = supabase
      .channel(`agent-run-${runId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_steps', filter: `run_id=eq.${runId}` },
        (payload) => mergeStep(payload.new),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'agent_runs', filter: `id=eq.${runId}` },
        (payload) => !cancelled && setState((prev) => ({ ...prev, id: runId, run: payload.new })),
      )
      .subscribe((status) => {
        if (cancelled) return
        if (status === 'SUBSCRIBED') {
          setState((prev) => ({ ...prev, id: runId, connected: true }))
          backfill()
        }
      })

    // Safety net: if the channel never connects (blocked websocket, cold
    // project), poll so the demo still tells a story.
    const poll = setInterval(backfill, 2500)

    return () => {
      cancelled = true
      clearInterval(poll)
      supabase.removeChannel(channel)
    }
  }, [runId])

  // Anything tagged with a different run is stale — treat it as empty.
  // Memoised, with a shared empty array: consumers derive React Flow nodes from
  // `steps`, so handing back a new array identity on every render would loop.
  return useMemo(() => {
    const fresh = state.id === runId && runId != null
    return {
      run: fresh ? state.run : null,
      steps: fresh ? state.steps : EMPTY_STEPS,
      connected: fresh ? state.connected : false,
    }
  }, [state, runId])
}

/** Kick off a demo run. Resolves with the run id to watch. */
export async function startDemoRun(message, { workflow = 'whatsapp-responder', engine, model } = {}) {
  const res = await fetch('/api/agent/demo', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, workflow, engine, model }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'The demo is unavailable right now.')
  return data.runId
}

/**
 * Workflow graphs and the orchestration engines installed on the server, served
 * by the API so there is one source of truth for both.
 */
export async function fetchWorkflows() {
  const res = await fetch('/api/workflows')
  if (!res.ok) throw new Error('Could not load workflows')
  const data = await res.json()
  return {
    workflows: data.workflows ?? [],
    engines: (data.engines ?? []).filter((e) => e.available),
    defaultEngine: data.defaultEngine ?? 'runner',
    models: data.models ?? [],
    defaultModel: data.defaultModel ?? null,
  }
}

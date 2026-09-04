import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  useNodesInitialized,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import Contact from '../components/Contact.jsx'
import { useAgentRun, startDemoRun, fetchWorkflows } from '../lib/agentRuns.js'

/*
 * Live agent workflows.
 *
 * A visitor types a message, our real agent runs against it, and the graph
 * lights up node by node as it works — pulled straight from the agent_runs /
 * agent_steps trace over Supabase Realtime. Nothing here is scripted: the
 * tokens, latencies and costs shown are the ones the run actually spent.
 *
 * Side effects are simulated server-side (demo mode), so no message is really
 * sent and no lead is really written.
 */

const EXAMPLES = [
  'Kitna charge karte ho website ke liye?',
  'We run a 12-store retail chain in Pune. Can you handle our Instagram + WhatsApp?',
  'I paid last month and nobody replied. I want a refund.',
  'क्या आप हिंदी में भी काम करते हैं?',
]

const STATUS_STYLE = {
  running: { ring: 'var(--color-gold)', glow: '0 0 0 3px rgba(240,163,47,.18)', dot: 'var(--color-gold)' },
  ok: { ring: 'var(--color-ember)', glow: '0 0 0 3px rgba(226,87,30,.14)', dot: 'var(--color-ember)' },
  error: { ring: '#E0524F', glow: '0 0 0 3px rgba(224,82,79,.16)', dot: '#E0524F' },
  skipped: { ring: 'var(--color-line)', glow: 'none', dot: 'var(--color-muted)' },
  idle: { ring: 'var(--color-line)', glow: 'none', dot: 'transparent' },
}

const KIND_LABEL = {
  trigger: 'trigger',
  guard: 'guard',
  tool: 'tool',
  llm: 'model',
  output: 'output',
}

function AgentNode({ data }) {
  const style = STATUS_STYLE[data.status] ?? STATUS_STYLE.idle
  const dim = data.status === 'idle'
  return (
    <div
      className="rounded-xl px-4 py-3 w-[196px] transition-all duration-300"
      style={{
        background: 'var(--color-card)',
        border: `1px solid ${style.ring}`,
        boxShadow: style.glow,
        opacity: dim ? 0.45 : 1,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: 'var(--color-line)', border: 'none' }} />
      <div className="flex items-center gap-2 mb-1">
        <span
          className="w-1.5 h-1.5 rounded-full shrink-0"
          style={{
            background: style.dot,
            animation: data.status === 'running' ? 'agentPulse 1s ease-in-out infinite' : 'none',
          }}
        />
        <span className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--color-muted)' }}>
          {KIND_LABEL[data.kind] ?? data.kind}
        </span>
      </div>
      <div className="text-[13px] leading-snug font-medium" style={{ color: 'var(--color-cream)' }}>
        {data.label}
      </div>
      <div className="text-[11px] mt-0.5" style={{ color: 'var(--color-muted)' }}>
        {data.latency != null ? `${data.latency} ms` : data.hint}
      </div>
      <Handle type="source" position={Position.Right} style={{ background: 'var(--color-line)', border: 'none' }} />
    </div>
  )
}

const nodeTypes = { agent: AgentNode }

/**
 * The canvas. Split out so it can sit inside ReactFlowProvider and use
 * useNodesInitialized — the graph is fetched after mount, so the `fitView` prop
 * runs against an empty canvas and we have to refit once nodes are measured.
 */
function FlowCanvas({ nodes, edges, onNodesChange, onEdgesChange }) {
  const initialized = useNodesInitialized()
  const { fitView } = useReactFlow()

  // Fit instantly, not as an animation: an animated fit is driven by
  // requestAnimationFrame, which throttles in a backgrounded tab and can leave
  // the graph frozen at an intermediate zoom.
  useEffect(() => {
    if (initialized && nodes.length) fitView({ padding: 0.1 })
  }, [initialized, nodes.length, fitView])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.12 }}
      proOptions={{ hideAttribution: true }}
      nodesDraggable={false}
      nodesConnectable={false}
      edgesFocusable={false}
      minZoom={0.3}
    >
      <Background color="rgba(244,234,219,.07)" gap={22} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  )
}

const money = (n) => (n == null ? '—' : `$${Number(n).toFixed(4)}`)

export default function AgentWorkflows() {
  const [graph, setGraph] = useState(null)
  const [message, setMessage] = useState('')
  // ?run=<id> replays a finished trace — the link is shareable, which is how we
  // hand a client the exact run we are talking about on a call.
  const [runId, setRunId] = useState(
    () => new URLSearchParams(window.location.search).get('run') ?? null,
  )
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState(null)
  // Same agent, same prompt, same tools — three orchestrators, several models.
  const [engines, setEngines] = useState([])
  const [engine, setEngine] = useState(null)
  const [models, setModels] = useState([])
  const [model, setModel] = useState(null)

  const { run, steps, connected } = useAgentRun(runId)

  // Keep the URL pointing at whatever run is on screen, without a navigation.
  useEffect(() => {
    const url = new URL(window.location.href)
    if (runId) url.searchParams.set('run', runId)
    else url.searchParams.delete('run')
    window.history.replaceState(null, '', url)
  }, [runId])

  useEffect(() => {
    fetchWorkflows()
      .then(({ workflows, engines: available, defaultEngine, models: list, defaultModel }) => {
        setGraph(workflows.find((w) => w.id === 'whatsapp-responder') ?? workflows[0] ?? null)
        setEngines(available)
        setModels(list)
        const startModel = list.some((m) => m.id === defaultModel) ? defaultModel : list[0]?.id ?? null
        setModel(startModel)
        // The engine must be able to reach the model's provider — `runner`
        // speaks the Anthropic API directly and cannot run Gemini.
        const provider = list.find((m) => m.id === startModel)?.provider
        const usable = available.filter((e) => e.providers?.includes(provider))
        setEngine(
          usable.some((e) => e.id === defaultEngine) ? defaultEngine : usable[0]?.id ?? null,
        )
      })
      .catch(() => setError('Could not load the workflow. Is the API running?'))
  }, [])

  const provider = models.find((m) => m.id === model)?.provider
  const usableEngines = useMemo(
    () => engines.filter((e) => !provider || e.providers?.includes(provider)),
    [engines, provider],
  )

  // Switching to a Gemini model can strand the selection on `runner`, so the
  // effective engine is derived rather than corrected in an effect — the same
  // stored choice comes back if you switch the model back to Claude.
  const activeEngine = usableEngines.some((e) => e.id === engine)
    ? engine
    : usableEngines[0]?.id ?? null

  // Latest state per node — a node can be visited more than once in one run.
  const nodeState = useMemo(() => {
    const map = new Map()
    for (const s of steps) map.set(s.node, s)
    return map
  }, [steps])

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])


  useEffect(() => {
    if (!graph) return
    setNodes(
      graph.nodes.map((n) => ({
        id: n.id,
        type: 'agent',
        position: { x: n.x, y: n.y },
        data: { ...n, status: 'idle', latency: null },
      })),
    )
    setEdges(
      graph.edges.map(([from, to]) => ({
        id: `${from}-${to}`,
        source: from,
        target: to,
        animated: false,
        style: { stroke: 'var(--color-line)', strokeWidth: 1.5 },
        markerEnd: { type: MarkerType.ArrowClosed, color: 'rgba(244,234,219,.2)' },
      })),
    )
  }, [graph, setNodes, setEdges])

  // Paint live status onto the graph as steps arrive.
  useEffect(() => {
    if (!graph) return
    setNodes((prev) =>
      prev.map((n) => {
        const s = nodeState.get(n.id)
        return {
          ...n,
          data: {
            ...n.data,
            status: s?.status ?? 'idle',
            latency: s?.latency_ms ?? null,
          },
        }
      }),
    )
    const active = new Set(steps.filter((s) => s.status !== 'skipped').map((s) => s.node))
    setEdges((prev) =>
      prev.map((e) => {
        const live = active.has(e.source) && active.has(e.target)
        return {
          ...e,
          animated: live && nodeState.get(e.target)?.status === 'running',
          style: {
            stroke: live ? 'var(--color-ember)' : 'var(--color-line)',
            strokeWidth: live ? 2 : 1.5,
            opacity: live ? 0.9 : 0.5,
          },
        }
      }),
    )
  }, [nodeState, steps, graph, setNodes, setEdges])

  const submit = useCallback(
    async (text) => {
      const body = (text ?? message).trim()
      if (!body || starting) return
      setStarting(true)
      setError(null)
      setRunId(null)
      try {
        setRunId(await startDemoRun(body, { engine: activeEngine, model }))
      } catch (e) {
        setError(e.message)
      } finally {
        setStarting(false)
      }
    },
    [message, starting, activeEngine, model],
  )

  const reply = run?.output?.reply
  const busy = starting || run?.status === 'running'

  return (
    <>
      <style>{`@keyframes agentPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(1.5)}}`}</style>

      <section className="px-5 md:px-10 pt-28 md:pt-36 pb-10 max-w-[1400px] mx-auto">
        <p className="text-xs uppercase tracking-[0.2em] mb-4" style={{ color: 'var(--color-gold)' }}>
          Live agent workflows
        </p>
        <h1 className="text-4xl md:text-6xl leading-[1.05] max-w-3xl">
          Watch the agent think, <span style={{ color: 'var(--color-ember)' }}>not a recording.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base md:text-lg" style={{ color: 'var(--color-muted)' }}>
          Send it a message the way a customer would. Every node below lights up as our real
          WhatsApp agent works through it — the tokens, timings and cost are the ones this run
          actually spent. Replies and lead updates are simulated here; nothing leaves the building.
        </p>
      </section>

      {/* composer */}
      <section className="px-5 md:px-10 max-w-[1400px] mx-auto">
        <div className="rounded-2xl p-5 md:p-6" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)' }}>
          <div className="flex flex-col md:flex-row gap-3">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              maxLength={500}
              placeholder="Type what a customer would send on WhatsApp…"
              className="flex-1 rounded-xl px-4 py-3 text-[15px] outline-none"
              style={{ background: 'var(--color-ground)', border: '1px solid var(--color-line)', color: 'var(--color-cream)' }}
            />
            <button
              onClick={() => submit()}
              disabled={busy || !message.trim()}
              className="rounded-xl px-6 py-3 text-[15px] font-medium transition-opacity disabled:opacity-40"
              style={{ background: 'var(--color-ember)', color: '#fff' }}
            >
              {busy ? 'Running…' : 'Run the agent'}
            </button>
          </div>

          {models.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <span
                className="text-[10px] uppercase tracking-[0.16em] mr-1 w-12"
                style={{ color: 'var(--color-muted)' }}
              >
                Model
              </span>
              {models.map((m) => {
                const on = m.id === model
                return (
                  <button
                    key={m.id}
                    onClick={() => setModel(m.id)}
                    disabled={busy}
                    title={`$${m.input} in / $${m.output} out per million tokens`}
                    className="text-[12px] rounded-full px-3 py-1.5 transition-colors disabled:opacity-40"
                    style={{
                      border: `1px solid ${on ? 'var(--color-ember)' : 'var(--color-line)'}`,
                      color: on ? 'var(--color-ember)' : 'var(--color-muted)',
                      background: on ? 'rgba(226,87,30,.08)' : 'transparent',
                    }}
                  >
                    {m.label}
                    <span className="opacity-60"> ${m.input}/${m.output}</span>
                  </button>
                )
              })}
            </div>
          )}

          {usableEngines.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span
                className="text-[10px] uppercase tracking-[0.16em] mr-1 w-12"
                style={{ color: 'var(--color-muted)' }}
              >
                Engine
              </span>
              {usableEngines.map((e) => {
                const on = e.id === activeEngine
                return (
                  <button
                    key={e.id}
                    onClick={() => setEngine(e.id)}
                    disabled={busy}
                    title={e.blurb ?? undefined}
                    className="text-[12px] rounded-full px-3 py-1.5 transition-colors disabled:opacity-40"
                    style={{
                      border: `1px solid ${on ? 'var(--color-gold)' : 'var(--color-line)'}`,
                      color: on ? 'var(--color-gold)' : 'var(--color-muted)',
                      background: on ? 'rgba(240,163,47,.08)' : 'transparent',
                    }}
                  >
                    {e.label}
                  </button>
                )
              })}
              <span className="text-[11px] w-full mt-1" style={{ color: 'var(--color-muted)' }}>
                Same prompt, same tools, same trace — only the orchestrator changes.
              </span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mt-4">
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => { setMessage(ex); submit(ex) }}
                disabled={busy}
                className="text-[12px] rounded-full px-3 py-1.5 transition-colors disabled:opacity-40"
                style={{ border: '1px solid var(--color-line)', color: 'var(--color-muted)' }}
              >
                {ex}
              </button>
            ))}
          </div>

          {error && (
            <p className="mt-4 text-sm" style={{ color: '#E0524F' }}>{error}</p>
          )}
        </div>
      </section>

      {/* graph + trace */}
      <section className="px-5 md:px-10 max-w-[1400px] mx-auto mt-6 grid lg:grid-cols-[1fr_360px] gap-5">
        <div
          className="rounded-2xl overflow-hidden h-[520px]"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)' }}
        >
          {/* Mount only once nodes exist — React Flow's `fitView` prop runs on
              mount, and mounting an empty canvas means it has nothing to fit. */}
          {nodes.length > 0 ? (
            <ReactFlowProvider>
              <FlowCanvas
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
              />
            </ReactFlowProvider>
          ) : (
            <div className="h-full grid place-items-center text-sm" style={{ color: 'var(--color-muted)' }}>
              Loading workflow…
            </div>
          )}
        </div>

        {/* trace panel */}
        <div
          className="rounded-2xl p-5 flex flex-col"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-line)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm uppercase tracking-[0.16em]" style={{ color: 'var(--color-muted)' }}>
              Trace
            </h2>
            <span className="flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--color-muted)' }}>
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: connected ? 'var(--color-gold)' : 'var(--color-line)' }}
              />
              {connected ? 'live' : 'idle'}
            </span>
          </div>

          {steps.length === 0 && (
            <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
              Run the agent to see each step, with its real latency and token cost.
            </p>
          )}

          <ol className="flex-1 overflow-y-auto space-y-2.5 -mr-2 pr-2">
            {steps.map((s) => (
              <li key={s.id} className="flex gap-2.5">
                <span
                  className="w-1.5 h-1.5 rounded-full mt-[7px] shrink-0"
                  style={{ background: (STATUS_STYLE[s.status] ?? STATUS_STYLE.idle).dot }}
                />
                <div className="min-w-0">
                  <div className="text-[13px]" style={{ color: 'var(--color-cream)' }}>
                    {s.label ?? s.node}
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--color-muted)' }}>
                    {s.status}
                    {s.latency_ms != null && ` · ${s.latency_ms} ms`}
                    {s.output_tokens > 0 && ` · ${s.input_tokens + s.output_tokens} tok`}
                  </div>
                  {s.error && (
                    <div className="text-[11px] mt-0.5" style={{ color: '#E0524F' }}>{s.error}</div>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {run && (
            <>
              <p
                className="text-[11px] mt-4 pt-3"
                style={{ borderTop: '1px solid var(--color-line)', color: 'var(--color-muted)' }}
              >
                ran on{' '}
                <span style={{ color: 'var(--color-gold)' }}>
                  {engines.find((e) => e.id === run.engine)?.label ?? run.engine}
                </span>
                {run.model && (
                  <>
                    {' · '}
                    <span style={{ color: 'var(--color-ember)' }}>
                      {models.find((m) => m.id === run.model)?.label ?? run.model}
                    </span>
                  </>
                )}
              </p>
              <dl className="grid grid-cols-3 gap-2 mt-3 text-center">
              {[
                ['Cost', money(run.cost_usd)],
                ['Tokens', (run.input_tokens ?? 0) + (run.output_tokens ?? 0)],
                ['Time', run.latency_ms != null ? `${(run.latency_ms / 1000).toFixed(1)}s` : '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--color-muted)' }}>{k}</dt>
                  <dd className="text-sm mt-0.5" style={{ color: 'var(--color-cream)' }}>{v}</dd>
                </div>
              ))}
              </dl>
            </>
          )}
        </div>
      </section>

      {/* the reply the agent produced */}
      {reply && (
        <section className="px-5 md:px-10 max-w-[1400px] mx-auto mt-5">
          <div
            className="rounded-2xl p-5 md:p-6"
            style={{ background: 'var(--color-card)', border: '1px solid var(--color-line)' }}
          >
            <p className="text-[10px] uppercase tracking-[0.16em] mb-3" style={{ color: 'var(--color-gold)' }}>
              What it would have sent
            </p>
            <p className="text-base md:text-lg leading-relaxed" style={{ color: 'var(--color-cream)' }}>
              {reply}
            </p>
          </div>
        </section>
      )}

      <div className="mt-20">
        <Contact />
      </div>
    </>
  )
}

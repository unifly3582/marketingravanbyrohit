// Browser half of the website voice agent.
//
// Owns the microphone, the socket and the speaker, and nothing about how any
// of it looks — the React component subscribes to events and renders them.
//
// Two AudioContexts on purpose. Capture must run at 16 kHz and playback
// arrives at 24 kHz; one context cannot be both, and resampling the agent's
// voice down and back up again is audible. Browsers allow several contexts,
// and both are created only after the visitor has clicked, which is what
// satisfies autoplay policy.

const INPUT_RATE = 16000
const OUTPUT_RATE = 24000

/** Playback is scheduled slightly ahead of the clock so chunk joins don't click. */
const SCHEDULE_LEAD = 0.08

export const STATES = {
  idle: 'idle',
  requesting: 'requesting', // waiting on the microphone permission prompt
  connecting: 'connecting',
  listening: 'listening',
  speaking: 'speaking',
  ended: 'ended',
  error: 'error',
}

/**
 * One conversation. Construct, `await start()`, and listen.
 *
 * Events: state, transcript, tool, navigate, identity, level, error, end.
 */
export class VoiceAgentClient extends EventTarget {
  /**
   * @param {object} opts
   * @param {string} [opts.page]
   * @param {string|null} [opts.wsOrigin]
   *   Origin to open the socket on, from /api/voice/web/config. Lets the audio
   *   skip a CDN that is fine for pages and costly for realtime — see the note
   *   on WEB_VOICE_WS_ORIGIN in server/voice/index.mjs. Null means same-origin.
   */
  constructor({ page = '/', wsOrigin = null } = {}) {
    super()
    this.page = page
    this.wsOrigin = wsOrigin
    this.state = STATES.idle
    this.ws = null
    this.stream = null
    this.captureCtx = null
    this.playCtx = null
    this.sources = new Set()
    this.playHead = 0
    this.runId = null
  }

  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }))
  }

  _setState(state) {
    if (this.state === state) return
    this.state = state
    this._emit('state', state)
  }

  /**
   * Ask for the microphone, then open the session.
   *
   * The permission prompt comes first and on its own: if the visitor says no,
   * nothing has been spent and no socket was opened.
   */
  async start() {
    if (this.state !== STATES.idle && this.state !== STATES.ended && this.state !== STATES.error) return
    this._setState(STATES.requesting)

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // The browser's own cleanup is better than anything we would do to
          // the samples here, and the model hears a laptop's speaker bleed as
          // itself talking.
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      })
    } catch (err) {
      const denied = err?.name === 'NotAllowedError' || err?.name === 'SecurityError'
      this._fail(
        denied
          ? 'Microphone access was blocked. Allow it in your browser’s address bar, then try again.'
          : 'No microphone found. Plug one in, or type to us instead.',
      )
      return
    }

    this._setState(STATES.connecting)
    try {
      await this._openAudio()
      await this._openSocket()
    } catch (err) {
      this._fail(err.message ?? 'Could not start the agent.')
    }
  }

  async _openAudio() {
    // Asking for the rate we want avoids resampling entirely on most devices;
    // the worklet handles the rest when a device refuses.
    this.captureCtx = new AudioContext({ sampleRate: INPUT_RATE })
    await this.captureCtx.audioWorklet.addModule('/voice-worklet.js')

    const source = this.captureCtx.createMediaStreamSource(this.stream)
    this.worklet = new AudioWorkletNode(this.captureCtx, 'mic-capture')
    this.worklet.port.onmessage = (e) => {
      if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(e.data)
    }

    // A tap purely for the UI: the orb should react to the visitor's voice, and
    // reading it here costs one analyser rather than a second capture graph.
    this.analyser = this.captureCtx.createAnalyser()
    this.analyser.fftSize = 256
    source.connect(this.analyser)
    source.connect(this.worklet)
    // The worklet emits nothing downstream, but Chrome will not pull from a
    // node that reaches no destination.
    this.worklet.connect(this.captureCtx.destination)

    this.playCtx = new AudioContext({ sampleRate: OUTPUT_RATE })
    this.playHead = this.playCtx.currentTime

    this._startLevelLoop()
  }

  _startLevelLoop() {
    const bins = new Uint8Array(this.analyser.frequencyBinCount)
    const tick = () => {
      if (!this.analyser) return
      this.analyser.getByteTimeDomainData(bins)
      let peak = 0
      for (const v of bins) peak = Math.max(peak, Math.abs(v - 128))
      this._emit('level', peak / 128)
      this.levelRaf = requestAnimationFrame(tick)
    }
    this.levelRaf = requestAnimationFrame(tick)
  }

  /**
   * Open the session, fastest route first.
   *
   * The direct host skips the CDN and is worth ~120 ms per round trip, so it is
   * always tried first. It is also a separate hostname, which is one more thing
   * that can fail independently of the site — a resolver that has the name
   * negatively cached will simply not find it, and that must not take the agent
   * down when the page's own origin would have worked.
   *
   * The fallback costs a working visitor nothing: it only runs if the first
   * route never opened, and VoiceAgent.jsx has usually already checked the
   * direct host in the background before anyone clicks.
   */
  _openSocket() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    const sameOrigin = `${proto}//${location.host}`
    // A configured origin already carries its own scheme; otherwise follow the
    // page's, so an https page never opens an insecure socket.
    const direct = this.wsOrigin ? this.wsOrigin.replace(/^http/, 'ws').replace(/\/+$/, '') : null
    const routes = direct && direct !== sameOrigin ? [direct, sameOrigin] : [sameOrigin]
    return this._connectVia(routes)
  }

  async _connectVia([base, ...rest]) {
    try {
      return await this._connect(base, rest.length > 0)
    } catch (err) {
      // A refusal is the server answering — rate limit, agent switched off.
      // Trying the same server by another name would only burn another slot.
      if (!rest.length || err.refused) throw err
      console.warn(`voice: could not reach ${base}, falling back to ${rest[0]}`)
      return this._connectVia(rest)
    }
  }

  _connect(base, hasFallback) {
    return new Promise((resolve, reject) => {
      // The worklet emits 8-bit µ-law; say so, or the server will read it as
      // PCM16 and hear noise.
      const url = `${base}/api/voice/web?codec=mulaw&page=${encodeURIComponent(this.page)}`
      const ws = new WebSocket(url)
      ws.binaryType = 'arraybuffer'
      this.ws = ws

      // Give up on an unreachable route quickly when there is somewhere else to
      // go; wait properly when this is the last chance.
      const deadline = hasFallback ? 4000 : 15000
      const failFast = setTimeout(
        () => reject(new Error('The agent did not answer. Try again.')),
        deadline,
      )

      // Until the server says "ready" this attempt is still a candidate, and a
      // failure has to leave the microphone and both audio contexts alone —
      // the next route is about to use them.
      let live = false
      const settle = (fn, arg) => {
        clearTimeout(failFast)
        fn(arg)
      }

      ws.onopen = () => clearTimeout(failFast)
      ws.onmessage = (e) => {
        if (e.data instanceof ArrayBuffer) return this._play(e.data)
        const msg = JSON.parse(e.data)
        // A refusal before the session starts is the server answering — a rate
        // limit, or the agent switched off. Reaching it by another name would
        // get the same answer and spend another slot doing it.
        if (msg.type === 'error' && !live) {
          const err = new Error(msg.message)
          err.refused = true
          return settle(reject, err)
        }
        if (msg.type === 'ready') live = true
        this._onControl(msg, resolve)
      }
      ws.onerror = () => {
        if (!live) return settle(reject, new Error('Could not reach the agent.'))
      }
      ws.onclose = () => {
        clearTimeout(failFast)
        if (!live) return reject(new Error('Could not reach the agent.'))
        if (this.state !== STATES.error) this._teardown(STATES.ended)
      }
    })
  }

  _onControl(msg, resolve) {
    switch (msg.type) {
      case 'ready':
        this.runId = msg.runId
        this._setState(STATES.listening)
        this._emit('ready', msg)
        resolve?.()
        break
      case 'transcript':
        this._emit('transcript', msg)
        break
      case 'tool':
        this._emit('tool', msg)
        break
      case 'navigate':
        this._emit('navigate', msg)
        break
      case 'identity':
      case 'callback':
      case 'whatsapp':
        this._emit(msg.type, msg)
        break
      case 'interrupted':
        // The visitor talked over the agent. Everything queued is a sentence
        // they have already decided not to hear.
        this._stopPlayback()
        this._setState(STATES.listening)
        break
      case 'turn_end':
        this._setState(STATES.listening)
        break
      case 'expiring':
        this._emit('expiring', msg)
        break
      case 'error':
        this._fail(msg.message)
        break
      case 'end':
        this._emit('end', msg)
        this._teardown(STATES.ended)
        break
      default:
        break
    }
  }

  /** Queue one 24 kHz PCM16 chunk end-to-end with whatever is already playing. */
  _play(arrayBuffer) {
    if (!this.playCtx) return
    const pcm = new Int16Array(arrayBuffer)
    if (!pcm.length) return

    const buf = this.playCtx.createBuffer(1, pcm.length, OUTPUT_RATE)
    const channel = buf.getChannelData(0)
    for (let i = 0; i < pcm.length; i++) channel[i] = pcm[i] / 0x8000

    const src = this.playCtx.createBufferSource()
    src.buffer = buf
    src.connect(this.playCtx.destination)

    // If the network fell behind, the play head is in the past; restart it
    // slightly ahead of now rather than firing every late chunk at once.
    const now = this.playCtx.currentTime
    if (this.playHead < now) this.playHead = now + SCHEDULE_LEAD
    src.start(this.playHead)
    this.playHead += buf.duration

    this.sources.add(src)
    src.onended = () => {
      this.sources.delete(src)
      if (!this.sources.size && this.state === STATES.speaking) this._setState(STATES.listening)
    }
    this._setState(STATES.speaking)
  }

  _stopPlayback() {
    for (const src of this.sources) {
      try {
        src.stop()
      } catch {
        /* already finished */
      }
    }
    this.sources.clear()
    this.playHead = this.playCtx?.currentTime ?? 0
  }

  /** Typed input — same loop, for a noisy room or someone who'd rather not talk. */
  sendText(text) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'text', text }))
  }

  /** Tell the agent the visitor navigated on their own, so it stays oriented. */
  setPage(path) {
    this.page = path
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'page', path }))
  }

  stop() {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ type: 'bye' }))
    this._teardown(STATES.ended)
  }

  _fail(message) {
    this._emit('error', { message })
    this._teardown(STATES.error)
  }

  /** Release the microphone and both audio contexts. Safe to call twice. */
  _teardown(state) {
    cancelAnimationFrame(this.levelRaf)
    this.levelRaf = null
    this._stopPlayback()

    this.worklet?.port.postMessage('stop')
    this.worklet?.disconnect()
    this.analyser?.disconnect()
    this.analyser = null
    this.worklet = null

    // Stopping the tracks is what actually turns the browser's recording
    // indicator off. Leaving it lit after a conversation ends is alarming, and
    // reasonably so.
    for (const track of this.stream?.getTracks() ?? []) track.stop()
    this.stream = null

    this.captureCtx?.close().catch(() => {})
    this.playCtx?.close().catch(() => {})
    this.captureCtx = null
    this.playCtx = null

    if (this.ws) {
      this.ws.onclose = null
      try {
        this.ws.close()
      } catch {
        /* already closing */
      }
      this.ws = null
    }
    this._setState(state)
  }
}

/**
 * Is this origin actually reachable from here, right now?
 *
 * The direct voice host is a separate hostname, so it can fail on its own — a
 * resolver holding a negative cache entry for it will not find it even while
 * the site loads perfectly. Checking in the background, before the visitor
 * clicks anything, means a bad route costs zero seconds instead of a timeout.
 *
 * `no-cors` because the voice host serves no CORS headers and does not need to:
 * an opaque response still proves the name resolved and the server answered,
 * which is the entire question. DNS and connection failures reject.
 */
export async function originReachable(origin, timeoutMs = 2500) {
  if (!origin) return false
  const http = origin.replace(/^ws/, 'http').replace(/\/+$/, '')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    await fetch(`${http}/api/voice/web/config`, {
      mode: 'no-cors',
      cache: 'no-store',
      signal: ctrl.signal,
    })
    return true
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/** Whether the agent is switched on server-side, and how it wants to be fed. */
export async function fetchVoiceConfig() {
  const res = await fetch('/api/voice/web/config')
  if (!res.ok) throw new Error('unavailable')
  return res.json()
}

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
  constructor({ page = '/' } = {}) {
    super()
    this.page = page
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

  _openSocket() {
    return new Promise((resolve, reject) => {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const url = `${proto}//${location.host}/api/voice/web?page=${encodeURIComponent(this.page)}`
      const ws = new WebSocket(url)
      ws.binaryType = 'arraybuffer'
      this.ws = ws

      const failFast = setTimeout(() => reject(new Error('The agent did not answer. Try again.')), 15000)

      ws.onopen = () => clearTimeout(failFast)
      ws.onmessage = (e) => {
        if (e.data instanceof ArrayBuffer) return this._play(e.data)
        this._onControl(JSON.parse(e.data), resolve)
      }
      ws.onerror = () => {
        clearTimeout(failFast)
        reject(new Error('Could not reach the agent.'))
      }
      ws.onclose = () => {
        clearTimeout(failFast)
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

/** Whether the agent is switched on server-side, and how it wants to be fed. */
export async function fetchVoiceConfig() {
  const res = await fetch('/api/voice/web/config')
  if (!res.ok) throw new Error('unavailable')
  return res.json()
}

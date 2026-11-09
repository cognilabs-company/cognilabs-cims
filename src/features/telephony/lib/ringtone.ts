/**
 * Incoming-call ringtone, synthesised with Web Audio (no audio file):
 * a soft marimba-like phrase that repeats until the call is answered or ends.
 * Browsers only allow sound after the user has interacted with the page,
 * which is always the case in a working CIMS session; otherwise it stays silent.
 */

type AudioContextCtor = typeof AudioContext

let context: AudioContext | null = null
let loopTimer: number | null = null
let master: GainNode | null = null

// An original rising phrase (E5 G#5 B5 E6 · B5 E6 G#6), 0.14 s apart, then a pause.
const PHRASE = [659.25, 830.61, 987.77, 1318.51, 987.77, 1318.51, 1661.22]
const STEP = 0.14
const LOOP_SECONDS = 2.6

function getContext() {
  if (context) return context
  const Ctor: AudioContextCtor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
  if (!Ctor) return null
  context = new Ctor()
  return context
}

/** One mallet hit: a sine with a little bright overtone and a fast decay. */
function strike(ctx: AudioContext, output: AudioNode, frequency: number, at: number) {
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, at)
  gain.gain.exponentialRampToValueAtTime(0.9, at + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.55)
  gain.connect(output)

  const body = ctx.createOscillator()
  body.type = 'sine'
  body.frequency.setValueAtTime(frequency, at)
  body.connect(gain)

  const shine = ctx.createOscillator()
  const shineGain = ctx.createGain()
  shine.type = 'sine'
  shine.frequency.setValueAtTime(frequency * 4, at)
  shineGain.gain.setValueAtTime(0.18, at)
  shineGain.gain.exponentialRampToValueAtTime(0.0001, at + 0.12)
  shine.connect(shineGain)
  shineGain.connect(gain)

  body.start(at)
  shine.start(at)
  body.stop(at + 0.6)
  shine.stop(at + 0.2)
}

function playPhrase(ctx: AudioContext, output: AudioNode) {
  const start = ctx.currentTime + 0.05
  PHRASE.forEach((frequency, index) => strike(ctx, output, frequency, start + index * STEP))
}

export function startRingtone() {
  if (loopTimer !== null) return
  const ctx = getContext()
  if (!ctx) return
  void ctx.resume().catch(() => {})
  master = ctx.createGain()
  master.gain.value = 0.22
  master.connect(ctx.destination)
  const output = master
  playPhrase(ctx, output)
  loopTimer = window.setInterval(() => playPhrase(ctx, output), LOOP_SECONDS * 1000)
}

export function stopRingtone() {
  if (loopTimer !== null) {
    window.clearInterval(loopTimer)
    loopTimer = null
  }
  if (master && context) {
    const fading = master
    fading.gain.setTargetAtTime(0.0001, context.currentTime, 0.05)
    window.setTimeout(() => fading.disconnect(), 300)
  }
  master = null
}

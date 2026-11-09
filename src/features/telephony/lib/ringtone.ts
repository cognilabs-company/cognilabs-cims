/**
 * Incoming-call ringtone: a marimba phone-ring loop played while an incoming
 * call rings, until it is answered, declined or silenced.
 *
 * Sound: "Simple Marimba Ringtone Loop" by BudgetPixel AI
 * (https://budgetpixel.com/sfx/simple-marimba-ringtone-loop-0c5b3be6) — CC BY 4.0.
 * See CREDITS.md. To use another sound, replace ../assets/ringtone.mp3
 * with a file you have the rights to.
 *
 * Browsers only allow sound after the user has interacted with the page
 * (normally the login click); if playback is blocked it stays silent.
 */
import ringtoneUrl from '../assets/ringtone.mp3'

let audio: HTMLAudioElement | null = null

function player() {
  if (!audio) {
    audio = new Audio(ringtoneUrl)
    audio.loop = true
    audio.preload = 'auto'
    audio.volume = 0.85
  }
  return audio
}

/** Load the file early so the first ring starts without delay. */
export function preloadRingtone() {
  if (typeof Audio !== 'undefined') player().load()
}

export function startRingtone() {
  if (typeof Audio === 'undefined') return
  const sound = player()
  if (!sound.paused) return
  sound.currentTime = 0
  void sound.play().catch(() => {})
}

export function stopRingtone() {
  if (!audio) return
  audio.pause()
  audio.currentTime = 0
}

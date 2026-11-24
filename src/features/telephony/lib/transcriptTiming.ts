import type { TranscriptSegment } from '../../../shared/api/services/telephonyQuality.service'
import { resolveSides, sideOf, type Turn } from './transcriptParse'

/* Puts the transcript on the audio's clock so the page can follow the recording word by word.
   Best case the backend sends segments with exact start/end (and maybe per-word) times: those are used
   as they are (`timeSegments`). Otherwise there is at best one start time per turn ("[0:14] Client: …"), so:
   - turns with a time start there; turns without one are spread between their timed neighbours by length;
   - with no times at all the talk is assumed to fill the end of the recording (the ringing comes first);
   - inside a turn the words are spread by their length over the time it takes to say them. */

export type TimedWord = { text: string; start: number; end: number }
export type TimedTurn = Turn & { start: number; end: number; words: TimedWord[] }

const PAUSE = 8 // a pause between turns, counted in characters
const SECONDS_PER_CHAR = 0.062 // ~16 characters a second: phone talk is quick, a slower guess makes the highlight lag

export function clockSeconds(value: string | null): number | null {
  if (!value) return null
  const parts = value.split(':').map(Number)
  if (parts.some((part) => !Number.isFinite(part))) return null
  return parts.reduce((sum, part) => sum * 60 + part, 0)
}

export function timeTurns(turns: Turn[], duration: number, talkSeconds: number): { turns: TimedTurn[]; timed: boolean } {
  const n = turns.length
  const weights = turns.map((turn) => turn.text.length + PAUSE)
  const at: number[] = [0]
  for (const weight of weights) at.push(at[at.length - 1] + weight)

  const anchors: Array<[number, number]> = []
  turns.forEach((turn, index) => {
    const seconds = clockSeconds(turn.time)
    if (seconds !== null && seconds <= duration && (anchors.length === 0 || seconds >= anchors[anchors.length - 1][1])) anchors.push([at[index], seconds])
  })
  const timed = anchors.length > 0
  if (!timed || anchors[0][0] > 0) {
    const lead = !timed && talkSeconds > 0 && duration - talkSeconds > 1 ? duration - talkSeconds : 0
    anchors.unshift([0, lead])
  }
  if (anchors[anchors.length - 1][0] < at[n]) anchors.push([at[n], Math.max(duration, anchors[anchors.length - 1][1])])

  const timeAt = (weight: number) => {
    for (let index = 1; index < anchors.length; index += 1) {
      const [w1, t1] = anchors[index]
      if (weight <= w1) {
        const [w0, t0] = anchors[index - 1]
        return w1 === w0 ? t0 : t0 + ((weight - w0) / (w1 - w0)) * (t1 - t0)
      }
    }
    return anchors[anchors.length - 1][1]
  }

  const result = turns.map((turn, index): TimedTurn => {
    const start = timeAt(at[index])
    const end = index === n - 1 ? Math.max(duration, start) : timeAt(at[index + 1])
    // With times from the text: words are said at speaking pace from the start of the turn, the rest of its
    // span is the pause after it. Without any times the whole talk is spread evenly, so each turn's words fill
    // its share (minus its pause) and the highlight never runs ahead and then waits.
    const chars = turn.text.length + 1
    const speech = timed
      ? Math.min((end - start) * 0.95, Math.max(0.5, chars * SECONDS_PER_CHAR))
      : (end - start) * (chars / (chars + PAUSE))
    return { ...turn, start, end, words: spread(turn.text, start, start + speech) }
  })
  return { turns: result, timed }
}

/** Splits text into words spread over [from, to] by their length (longer words take longer to say). */
function spread(text: string, from: number, to: number): TimedWord[] {
  const tokens = text.split(/\s+/).filter(Boolean)
  const chars = tokens.reduce((sum, token) => sum + token.length + 1, 0)
  if (!chars) return []
  let cursor = 0
  return tokens.map((token) => {
    const start = from + (cursor / chars) * (to - from)
    cursor += token.length + 1
    return { text: token, start, end: from + (cursor / chars) * (to - from) }
  })
}

/** Segments that already carry their own times: exact, no guessing beyond the words inside a segment
    (spread over the segment's own span when the backend gives no per-word times). */
export function timeSegments(segments: TranscriptSegment[], sellerName: string | null, customerName: string | null, duration: number): TimedTurn[] {
  const turns = segments.map((segment, index): TimedTurn => {
    const next = segments[index + 1]?.start
    const guess = segment.start + Math.max(0.5, (segment.text.length + 1) * SECONDS_PER_CHAR)
    const end = segment.end !== null && segment.end > segment.start ? segment.end : Math.min(guess, next ?? Math.max(duration, guess))
    const words = segment.words?.length ? segment.words : spread(segment.text, segment.start, end)
    const side = segment.speaker ? sideOf(segment.speaker, sellerName, customerName) : null
    return { id: index, speaker: segment.speaker, side: side ?? 'other', time: null, text: segment.text, start: segment.start, end, words }
  })
  return resolveSides(turns)
}

/** Which turn and word are being said at `time` (-1 when before the first or between nothing).
    `speaking` is false in the pause after the turn's last word, so nothing is lit while nobody talks. */
export function positionAt(turns: TimedTurn[], time: number): { turn: number; word: number; speaking: boolean } {
  let low = 0
  let high = turns.length - 1
  let found = -1
  while (low <= high) {
    const middle = (low + high) >> 1
    if (turns[middle].start <= time) { found = middle; low = middle + 1 } else high = middle - 1
  }
  if (found === -1) return { turn: -1, word: -1, speaking: false }
  const words = turns[found].words
  let word = -1
  for (let index = 0; index < words.length; index += 1) {
    if (words[index].start <= time) word = index
    else break
  }
  const last = words[words.length - 1]
  return { turn: found, word, speaking: word >= 0 && (word < words.length - 1 || !last || time <= last.end + 0.35) }
}

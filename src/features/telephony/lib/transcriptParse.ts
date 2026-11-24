/* Splits the transcript text into turns: usually one "Speaker: words" line per turn, sometimes with a
   [00:12] time in front. Lines without a speaker belong to the turn above. */

export type Side = 'seller' | 'client' | 'other'
export type Turn = { id: number; speaker: string | null; side: Side; time: string | null; text: string }

const SELLER_WORDS = ['менеджер', 'manager', 'оператор', 'operator', 'seller', 'sotuvchi', 'продавец', 'agent', 'агент', 'sales', 'consultant', 'консультант', 'xodim', 'сотрудник', 'menejer']
const CLIENT_WORDS = ['клиент', 'client', 'customer', 'mijoz', 'покупатель', 'abonent', 'абонент', 'caller', 'lead', 'лид']

const LINE = /^\s*(?:\[?\(?(\d{1,2}:\d{2}(?::\d{2})?)\)?\]?\s*[-–—]?\s*)?(?:\*\*)?([^:\n]{1,32}?)(?:\*\*)?\s*:\s+(.+)$/
const TIME_ONLY = /^\s*\[?\(?(\d{1,2}:\d{2}(?::\d{2})?)\)?\]?\s*[-–—]?\s*(.+)$/

export function sideOf(speaker: string, sellerName: string | null, customerName: string | null): Side | null {
  const key = speaker.toLowerCase()
  if (SELLER_WORDS.some((word) => key.includes(word))) return 'seller'
  if (CLIENT_WORDS.some((word) => key.includes(word))) return 'client'
  const first = (name: string | null) => (name ?? '').trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  if (first(sellerName).length > 2 && key.includes(first(sellerName))) return 'seller'
  if (first(customerName).length > 2 && key.includes(first(customerName))) return 'client'
  return null
}

export function parseTranscript(text: string, sellerName: string | null, customerName: string | null): Turn[] {
  const turns: Turn[] = []
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    const match = LINE.exec(line)
    // A "speaker" made of many words is most likely a sentence with a colon, not a label.
    if (match && match[2].trim().split(/\s+/).length <= 4 && !/[.!?]$/.test(match[2].trim())) {
      const speaker = match[2].trim()
      const side = sideOf(speaker, sellerName, customerName)
      turns.push({ id: turns.length, speaker, side: side ?? 'other', time: match[1] ?? null, text: match[3].trim() })
      continue
    }
    const timed = TIME_ONLY.exec(line)
    const last = turns[turns.length - 1]
    if (last && !timed) last.text += `\n${line}`
    else turns.push({ id: turns.length, speaker: null, side: 'other', time: timed?.[1] ?? null, text: (timed?.[2] ?? line).trim() })
  }
  return resolveSides(splitLong(turns))
}

const LONG_TURN = 220 // a labelled turn longer than this is broken into sentences too

/** One line per sentence. When the AI sends the talk as one paragraph (no speakers, no times) it would
    otherwise be a single wall of text with nothing to follow; split, every sentence is its own line that
    lights up while it is said. Very short bits ("ha.") stay with the sentence after them. */
function splitLong(turns: Turn[]): Turn[] {
  const result: Turn[] = []
  for (const turn of turns) {
    const sentences = turn.speaker && turn.text.length <= LONG_TURN ? [turn.text] : sentencesOf(turn.text)
    sentences.forEach((sentence, index) => {
      result.push({ ...turn, id: result.length, time: index === 0 ? turn.time : null, text: turn.speaker ? sentence : capitalize(sentence) })
    })
  }
  return result
}

export function sentencesOf(text: string): string[] {
  const pieces = text.split(/\n+|(?<=[.!?…])\s+/).map((piece) => piece.trim()).filter(Boolean)
  const merged: string[] = []
  let carry = ''
  for (const piece of pieces) {
    const joined = carry ? `${carry} ${piece}` : piece
    if (joined.length < 14) carry = joined
    else { merged.push(joined); carry = '' }
  }
  if (carry) {
    if (merged.length) merged[merged.length - 1] += ` ${carry}`
    else merged.push(carry)
  }
  return merged.length ? merged : [text.trim()]
}

function capitalize(text: string): string {
  return text.replace(/(^\P{L}*|[.!?…]\s+)(\p{Ll})/gu, (_, lead: string, letter: string) => lead + letter.toLocaleUpperCase())
}

/** Generic labels (SPEAKER_00 / Speaker A): if the other side is already known, the leftover one is its partner;
    otherwise keep them neutral but still on two sides so the dialogue reads as a dialogue. */
export function resolveSides<T extends { speaker: string | null; side: Side }>(turns: T[]): T[] {
  const unknown: string[] = []
  for (const turn of turns) if (turn.side === 'other' && turn.speaker && !unknown.includes(turn.speaker)) unknown.push(turn.speaker)
  const known = new Set(turns.filter((turn) => turn.side !== 'other').map((turn) => turn.side))
  if (unknown.length === 1 && known.size === 1) {
    const partner: Side = known.has('seller') ? 'client' : 'seller'
    for (const turn of turns) if (turn.speaker === unknown[0]) turn.side = partner
  } else if (unknown.length === 2 && known.size === 0) {
    for (const turn of turns) if (turn.speaker === unknown[1]) turn.side = 'client'
  }
  return turns
}

/** "SPEAKER_00", "speaker 1", "Speaker A", "1-so'zlovchi" → the raw number (letters count from one);
    null for real names and roles. Use `speakerLabels` to turn them into people counted from one. */
export function speakerNumber(speaker: string | null): number | null {
  const text = speaker?.trim() ?? ''
  const before = text.match(/^(\d+)\s*-?\s*(?:so\S?zlovchi|спикер|speaker)$/i)
  if (before) return Number(before[1])
  const after = text.match(/^(?:speaker|spk|спикер|говорящий|so\S?zlovchi)[\s_-]*(\d+|[a-z])$/i)
  if (!after) return null
  return /^\d+$/.test(after[1]) ? Number(after[1]) : after[1].toLowerCase().charCodeAt(0) - 96
}

/** Generic speakers numbered from one: SPEAKER_00 / SPEAKER_01 become 1 and 2, "Speaker 1" stays 1. */
export function speakerNumbers(speakers: Array<string | null>): Map<string, number> {
  const raw = new Map<string, number>()
  for (const speaker of speakers) {
    const value = speakerNumber(speaker)
    if (speaker && value !== null) raw.set(speaker, value)
  }
  const shift = [...raw.values()].some((value) => value === 0) ? 1 : 0
  return new Map([...raw].map(([speaker, value]) => [speaker, value + shift]))
}

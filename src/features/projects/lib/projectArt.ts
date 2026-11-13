/** Card colour of a project tile. `light` is the default; the others are used only with an illustration made for them. */
export type ProjectTone = 'light' | 'brand' | 'ink' | 'coral'

const TONES = new Set<ProjectTone>(['light', 'brand', 'ink', 'coral'])

/**
 * 3D illustrations for the project tiles, one per project, kept next to the code:
 * `src/assets/projects/<projectId>-<tone>.webp` (or .png), transparent background.
 * `tone` is the card colour the picture was made for. Adding a file is enough — no code change.
 */
const files = import.meta.glob<string>('../../../assets/projects/*.{webp,png}', { eager: true, query: '?url', import: 'default' })

const byProject = new Map<number, { src: string; tone: ProjectTone }>()
for (const [path, src] of Object.entries(files)) {
  const match = /\/(\d+)-([a-z]+)\.(?:webp|png)$/.exec(path)
  if (!match) continue
  const tone = TONES.has(match[2] as ProjectTone) ? (match[2] as ProjectTone) : 'light'
  byProject.set(Number(match[1]), { src, tone })
}

export function projectArt(projectId: number) {
  return byProject.get(projectId) ?? null
}

/**
 * The project name on two lines like the tiles' headings: the first part dark, the rest muted.
 * Words are split where the two parts are closest in length ("Content | Creation").
 */
export function splitProjectName(name: string): [string, string] {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length < 2) return [name.trim(), '']
  let best = 1
  let bestDiff = Infinity
  for (let index = 1; index < words.length; index += 1) {
    const diff = Math.abs(words.slice(0, index).join(' ').length - words.slice(index).join(' ').length)
    if (diff < bestDiff) {
      bestDiff = diff
      best = index
    }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')]
}

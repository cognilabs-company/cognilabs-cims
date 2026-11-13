/**
 * 3D objects for the project cards, one per project, kept next to the code:
 * `src/assets/projects/<projectId>.webp` (or .png) with a transparent background, trimmed to the object.
 * Adding a file is enough — no code change.
 */
const files = import.meta.glob<string>('../../../assets/projects/*.{webp,png}', { eager: true, query: '?url', import: 'default' })

export type ProjectArt = { src: string }

const byProject = new Map<number, ProjectArt>()
for (const [path, src] of Object.entries(files)) {
  const match = /\/(\d+)\.(?:webp|png)$/i.exec(path)
  if (match) byProject.set(Number(match[1]), { src })
}

export function projectArt(projectId: number): ProjectArt | null {
  return byProject.get(projectId) ?? null
}

/**
 * The project name on two lines, as on the cards: the first part dark, the rest grey.
 * Words are split where the two parts are closest in length ("Cognilabs | Management").
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

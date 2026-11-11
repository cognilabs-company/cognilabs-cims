/** Stable colour for a project (hue 0–359) — same in the 3D map, cards and the sidebar. */
export function projectHue(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  // Keep to the brand-friendly part of the wheel: blues, violets, teals, greens, warm accents.
  const hues = [222, 248, 268, 196, 172, 152, 32, 340, 208, 286]
  return hues[hash % hues.length]
}

export function projectInitial(name: string) {
  return name.trim().charAt(0).toUpperCase() || '•'
}

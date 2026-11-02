export type SeriesStyle = {
  bar: string
  dot: string
  pill: string
  pillText: string
}

export const seriesStyles: SeriesStyle[] = [
  { bar: 'linear-gradient(180deg,#C9F57E 0%,#A6E83B 100%)', dot: '#A6E83B', pill: '#FFFFFF', pillText: '#3F6E06' },
  { bar: 'linear-gradient(180deg,#E3EAFF 0%,#C6D4FF 100%)', dot: '#C6D4FF', pill: '#FFFFFF', pillText: '#2B59FF' },
  { bar: 'linear-gradient(180deg,#5B80FF 0%,#2350F5 100%)', dot: '#2B59FF', pill: 'rgba(255,255,255,0.22)', pillText: '#FFFFFF' },
  { bar: 'linear-gradient(180deg,#DDEBF5 0%,#B7D3C6 100%)', dot: '#B7D3C6', pill: '#FFFFFF', pillText: '#2E6B55' },
  { bar: 'repeating-linear-gradient(135deg,#F1F3F8 0 8px,#E6E9F1 8px 16px)', dot: '#D6DAE5', pill: '#FFFFFF', pillText: '#4A5165' },
]

export function seriesStyleAt(index: number): SeriesStyle {
  return seriesStyles[index % seriesStyles.length]
}

export const arcColors = ['#A6E83B', '#C6D4FF', '#2B59FF', '#FFB86B', '#E9D8FF', '#B7D3C6']

export function arcColorAt(index: number) {
  return arcColors[index % arcColors.length]
}

export const chartNeutrals = {
  grid: '#ECEEF3',
  axis: '#8A90A2',
  ink: '#0E1525',
}

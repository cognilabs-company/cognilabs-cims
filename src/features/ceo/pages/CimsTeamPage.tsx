import { ArrowUpRight, Bot, Copy, Instagram, Send, Sparkles } from 'lucide-react'
import { useTheme } from '../../../app/hooks/useTheme'
import { useLocale } from '../../../app/hooks/useLocale'
import { useToast } from '../../../shared/toast/useToast'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { cn } from '../../../shared/lib/cn'

const teamLinks = [
  {
    titleKey: 'cims.instagram.title',
    eyebrowKey: 'cims.instagram.eyebrow',
    handle: '@cognilabs_uz',
    href: 'https://www.instagram.com/cognilabs_uz',
    noteKey: 'cims.instagram.note',
    categoryKey: 'cims.category.official',
    accent: 'blue',
    icon: Instagram,
  },
  {
    titleKey: 'cims.telegram.title',
    eyebrowKey: 'cims.telegram.eyebrow',
    handle: '@cognilabs_software',
    href: 'https://t.me/cognilabs_software',
    noteKey: 'cims.telegram.note',
    categoryKey: 'cims.category.channel',
    accent: 'violet',
    icon: Send,
  },
  {
    titleKey: 'cims.recall.title',
    eyebrowKey: 'cims.recall.eyebrow',
    handle: '@cognilabsrecallbot',
    href: 'https://t.me/cognilabsrecallbot',
    noteKey: 'cims.recall.note',
    categoryKey: 'cims.category.bot',
    accent: 'amber',
    icon: Bot,
  },
  {
    titleKey: 'cims.update.title',
    eyebrowKey: 'cims.update.eyebrow',
    handle: '@cognilabsupdatebot',
    href: 'https://t.me/cognilabsupdatebot',
    noteKey: 'cims.update.note',
    categoryKey: 'cims.category.bot',
    accent: 'emerald',
    icon: Sparkles,
  },
] as const

function withAlpha(hex: string, alpha: number) {
  const normalized = hex.replace('#', '')
  const safeHex = normalized.length === 3
    ? normalized.split('').map((char) => `${char}${char}`).join('')
    : normalized

  const red = Number.parseInt(safeHex.slice(0, 2), 16)
  const green = Number.parseInt(safeHex.slice(2, 4), 16)
  const blue = Number.parseInt(safeHex.slice(4, 6), 16)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

const accentThemes = {
  blue: {
    lightColor: '#2576EF',
    darkColor: '#60A5FA',
  },
  violet: {
    lightColor: '#8A3AED',
    darkColor: '#A78BFA',
  },
  amber: {
    lightColor: '#B45309',
    darkColor: '#FBBF24',
  },
  emerald: {
    lightColor: '#289075',
    darkColor: '#34D399',
  },
} as const

export function CimsTeamPage() {
  const { theme } = useTheme()
  const { t } = useLocale()
  const { showToast } = useToast()
  const isLight = theme === 'light'

  async function handleCopyLink(link: string, label: string) {
    try {
      await navigator.clipboard.writeText(link)
      showToast({
        title: t('cims.link_copied'),
        description: `${label} ${t('cims.link_copied_desc')}`,
        tone: 'success',
      })
    } catch {
      showToast({
        title: t('cims.copy_failed'),
        description: t('cims.copy_failed_desc'),
        tone: 'error',
      })
    }
  }

  return (
    <section className="space-y-4 page-enter">
      <div className="grid gap-4 xl:grid-cols-2">
        {teamLinks.map((link) => {
          const Icon = link.icon
          const accent = accentThemes[link.accent]
          const title = t(link.titleKey)
          const eyebrow = t(link.eyebrowKey)
          const note = t(link.noteKey)
          const category = t(link.categoryKey)
          const accentColor = isLight ? accent.lightColor : accent.darkColor
          const cardBorder = withAlpha(accentColor, isLight ? 0.26 : 0.32)
          const cardSurface = withAlpha(accentColor, isLight ? 0.08 : 0.18)
          const cardGlow = withAlpha(accentColor, isLight ? 0.10 : 0.14)
          const iconSurface = withAlpha(accentColor, isLight ? 0.12 : 0.16)
          const iconBorder = withAlpha(accentColor, isLight ? 0.24 : 0.28)
          const chipSurface = withAlpha(accentColor, isLight ? 0.10 : 0.14)
          const chipBorder = withAlpha(accentColor, isLight ? 0.26 : 0.30)
          const actionSurface = withAlpha(accentColor, isLight ? 0.14 : 0.12)
          const actionBorder = withAlpha(accentColor, isLight ? 0.28 : 0.30)
          const topLine = `linear-gradient(90deg, ${withAlpha(accentColor, 0.54)} 0%, ${withAlpha(accentColor, 0.22)} 58%, transparent 86%)`
          const cardBackground = isLight
            ? `linear-gradient(180deg, ${cardSurface} 0%, rgba(255,255,255,0.98) 100%)`
            : `linear-gradient(180deg, ${cardSurface} 0%, rgba(18,22,32,0.98) 56%, rgba(10,13,20,0.98) 100%)`
          const cardShadow = isLight
            ? `inset 0 0 0 1px ${withAlpha(accentColor, 0.08)}, 0 18px 42px rgba(15,23,42,0.10), 0 0 32px ${cardGlow}`
            : `inset 0 0 0 1px ${withAlpha(accentColor, 0.10)}, 0 18px 42px rgba(0,0,0,0.34), 0 0 32px ${cardGlow}`

          return (
            <Card
              key={link.href}
              className={cn(
                'group relative overflow-hidden rounded-xl border p-6 transition-transform duration-200 hover:-translate-y-[2px]',
              )}
              style={{
                borderColor: cardBorder,
                background: cardBackground,
                boxShadow: cardShadow,
              }}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: topLine }} />

              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-12 w-12 place-items-center rounded-xl border"
                    style={{
                      borderColor: iconBorder,
                      backgroundColor: iconSurface,
                      color: accentColor,
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.24em]" style={{ color: accentColor }}>{eyebrow}</p>
                    <h3 className="mt-1 text-xl font-extrabold tracking-tight" style={{ color: accentColor }}>{title}</h3>
                  </div>
                </div>

                <span
                  className="inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
                  style={{
                    color: accentColor,
                    borderColor: chipBorder,
                    backgroundColor: chipSurface,
                  }}
                >
                  {category}
                </span>
              </div>

              <div className="mt-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">{t('cims.handle')}</p>
                <p className="mt-2 break-all font-mono text-[15px] text-[var(--foreground)]">{link.handle}</p>
                <p className="mt-4 text-sm leading-6 text-[var(--muted-strong)]">{note}</p>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:-translate-y-[1px]"
                  style={{
                    color: accentColor,
                    borderColor: actionBorder,
                    backgroundColor: actionSurface,
                  }}
                >
                  {t('cims.open_link')}
                  <ArrowUpRight className="h-4 w-4" />
                </a>

                <Button
                  variant="ghost"
                  size="lg"
                  className="justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--blue-border)] hover:bg-[var(--surface-elevated)]"
                  leftIcon={<Copy className="h-4 w-4" />}
                  onClick={() => void handleCopyLink(link.href, title)}
                >
                  {t('cims.copy')}
                </Button>
              </div>
            </Card>
          )
        })}
      </div>
    </section>
  )
}

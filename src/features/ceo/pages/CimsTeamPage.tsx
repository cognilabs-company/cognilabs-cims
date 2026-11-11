import { InstagramLogoIcon, RobotIcon, SparkleIcon, TelegramLogoIcon } from '@phosphor-icons/react'
import { ArrowUpRight, Bot, Copy, Instagram, Send, Sparkles } from 'lucide-react'
import { useLocale } from '../../../app/hooks/useLocale'
import { useToast } from '../../../shared/toast/useToast'
import { Badge } from '../../../shared/ui/badge'
import { Button } from '../../../shared/ui/button'
import { Card } from '../../../shared/ui/card'
import { StatCard } from '../../../shared/ui/stat-card'
import { toneSurface, toneText } from '../../../shared/ui/tone'
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
    accent: 'warning',
    icon: Bot,
  },
  {
    titleKey: 'cims.update.title',
    eyebrowKey: 'cims.update.eyebrow',
    handle: '@cognilabsupdatebot',
    href: 'https://t.me/cognilabsupdatebot',
    noteKey: 'cims.update.note',
    categoryKey: 'cims.category.bot',
    accent: 'success',
    icon: Sparkles,
  },
] as const

const telegramSurfaces = teamLinks.filter((link) => link.href.includes('t.me'))
const automationBots = teamLinks.filter((link) => link.categoryKey === 'cims.category.bot')
const socialPages = teamLinks.filter((link) => link.categoryKey === 'cims.category.official')
const telegramChannel = teamLinks.find((link) => link.categoryKey === 'cims.category.channel')
const primaryBot = automationBots[0]

function openExternal(href: string) {
  window.open(href, '_blank', 'noopener,noreferrer')
}

export function CimsTeamPage() {
  const { t } = useLocale()
  const { showToast } = useToast()

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
    <section className="page-enter flex flex-col gap-[18px]">
      <div className="flex items-center justify-end">
        <h1 className="sr-only">{t('cims.page.title', 'CIMS Team')}</h1>

        <Badge variant="blue" dot>{t('cims.overview.workspace', 'Workspace links')}</Badge>
      </div>

      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
        <StatCard
          solid
          label={t('cims.metric.touchpoints', 'Team touchpoints')}
          value={teamLinks.length}
          hint={t('cims.metric.touchpoints_hint', 'Channels and bots kept in one board')}
          icon={<SparkleIcon />}
        />
        <StatCard
          label={t('cims.metric.telegram', 'Telegram surfaces')}
          value={telegramSurfaces.length}
          hint={t('cims.metric.telegram_hint', 'Channel and bots on Telegram')}
          icon={<TelegramLogoIcon />}
          iconTone="blue"
          onOpen={telegramChannel ? () => openExternal(telegramChannel.href) : undefined}
          openLabel={t('cims.open_link')}
        />
        <StatCard
          label={t('cims.metric.bots', 'Automation bots')}
          value={automationBots.length}
          hint={t('cims.metric.bots_hint', 'Recall and update workflows')}
          icon={<RobotIcon />}
          iconTone="warning"
          onOpen={primaryBot ? () => openExternal(primaryBot.href) : undefined}
          openLabel={t('cims.open_link')}
        />
        <StatCard
          label={t('cims.metric.social', 'Social pages')}
          value={socialPages.length}
          hint={t('cims.metric.social_hint', 'Public brand presence')}
          icon={<InstagramLogoIcon />}
          iconTone="violet"
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="ui-section-title text-[var(--foreground)]">
          {t('cims.overview.channels', 'Channels and bots')}
        </h2>
        <span className="text-[13px] text-[var(--muted)]">
          {t('cims.overview.handles', 'Handles')}{' '}
          <b className="font-semibold text-[var(--foreground)]" data-ui-number="true">{teamLinks.length}</b>
        </span>
      </div>

      <div className="grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(340px,1fr))]">
        {teamLinks.map((link) => {
          const Icon = link.icon
          const tone = link.accent
          const title = t(link.titleKey)
          const eyebrow = t(link.eyebrowKey)
          const note = t(link.noteKey)
          const category = t(link.categoryKey)

          return (
            <Card key={link.href} className="flex flex-col gap-[18px]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    className={cn(
                      'grid h-11 w-11 shrink-0 place-items-center rounded-[14px]',
                      toneSurface[tone],
                      toneText[tone],
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium text-[var(--muted)]">{eyebrow}</p>
                    <h3 className="mt-0.5 text-[17px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">{title}</h3>
                  </div>
                </div>

                <Badge variant={tone}>{category}</Badge>
              </div>

              <div className="rounded-[18px] bg-[var(--accent-soft)] px-4 py-3.5">
                <p className="text-xs font-medium text-[var(--muted)]">{t('cims.handle')}</p>
                <p className="mt-1 font-mono text-sm break-all text-[var(--foreground)]" data-i18n-skip="true">{link.handle}</p>
              </div>

              <p className="text-sm leading-[1.55] text-[var(--muted-strong)]">{note}</p>

              <div className="mt-auto grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <Button asChild>
                  <a href={link.href} target="_blank" rel="noreferrer">
                    {t('cims.open_link')}
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                </Button>

                <Button
                  variant="secondary"
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

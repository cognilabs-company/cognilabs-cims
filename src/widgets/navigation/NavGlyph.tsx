import type { LucideIcon, LucideProps } from 'lucide-react'
import {
  Archive, Blocks, ChartPie, CalendarClock, CalendarCog, CalendarRange, Circle, CircleUserRound, Contact, CreditCard, FolderKanban,
  Globe, Images, LayoutDashboard, ListChecks, ListTodo, LockKeyhole, LogOut, MessageCircleReply, MessagesSquare, Newspaper,
  Phone, Plug, ScrollText, ServerCog, Sparkles, SquareKanban, TrendingUp, TriangleAlert, UserCheck, UserCog, Users, Wallet,
} from 'lucide-react'
import { cn } from '../../shared/lib/cn'
import type { GlyphName } from './navGlyphMap'

const glyphs: Record<GlyphName, LucideIcon> = {
  member: CircleUserRound,
  ai: Sparkles,
  ceo: LayoutDashboard,
  crm: ChartPie,
  customers: Contact,
  'my-leads': UserCheck,
  phone: Phone,
  users: UserCog,
  'team-updates': CalendarRange,
  website: Globe,
  workday: CalendarCog,
  salary: Wallet,
  faults: TriangleAlert,
  payment: CreditCard,
  wordpress: Newspaper,
  updates: ListChecks,
  auth: LockKeyhole,
  integrations: Blocks,
  projects: FolderKanban,
  management: ServerCog,
  team: Users,
  'cognilabsai-chat': MessagesSquare,
  'ai-kanban': SquareKanban,
  media: Images,
  'cognilabsai-integrations': Plug,
  instagram: MessageCircleReply,
  audit: ScrollText,
  kpi: TrendingUp,
  attendance: CalendarClock,
  archive: Archive,
  statuses: ListTodo,
  exit: LogOut,
  default: Circle,
}

type NavGlyphProps = Omit<LucideProps, 'ref'> & { name: GlyphName }

/** Sidebar / header icon: one consistent stroke icon set (lucide), 1.8px stroke. */
export function NavGlyph({ name, className, ...props }: NavGlyphProps) {
  const Icon = glyphs[name] ?? Circle
  return <Icon strokeWidth={1.8} aria-hidden="true" className={cn('h-[18px] w-[18px] shrink-0 text-current', className)} {...props} />
}

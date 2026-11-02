import {
  Archive,
  Bot,
  CalendarCheck,
  CalendarRange,
  Circle,
  ClipboardList,
  Columns3,
  CreditCard,
  FolderKanban,
  Gauge,
  Globe,
  Images,
  LayoutDashboard,
  LogIn,
  LogOut,
  MessageSquare,
  MessagesSquare,
  Plug,
  ScrollText,
  Settings2,
  ShieldCheck,
  Tags,
  User,
  UserCheck,
  Users,
  Wallet,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react'
import { cn } from '../../shared/lib/cn'
import type { GlyphName } from './navGlyphMap'

type NavGlyphProps = LucideProps & {
  name: GlyphName
}

const glyphs: Record<GlyphName, LucideIcon> = {
  member: User,
  ai: Bot,
  ceo: LayoutDashboard,
  crm: Users,
  'my-leads': UserCheck,
  users: ShieldCheck,
  'team-updates': CalendarRange,
  'website-stats': Globe,
  faults: Wallet,
  payment: CreditCard,
  wordpress: Globe,
  updates: ClipboardList,
  auth: LogIn,
  integrations: Plug,
  projects: FolderKanban,
  management: Settings2,
  'cognilabsai-chat': MessageSquare,
  'cognilabsai-kanban': Columns3,
  'cognilabsai-media': Images,
  'cognilabsai-comments': MessagesSquare,
  'cognilabsai-integrations': Plug,
  'developer-kpi': Gauge,
  audit: ScrollText,
  attendance: CalendarCheck,
  archive: Archive,
  statuses: Tags,
  exit: LogOut,
  default: Circle,
}

export function NavGlyph({ name, className, ...props }: NavGlyphProps) {
  const Icon = glyphs[name] ?? Circle

  return (
    <Icon
      strokeWidth={1.8}
      className={cn('h-5 w-5 shrink-0 text-current', className)}
      aria-hidden="true"
      {...props}
    />
  )
}

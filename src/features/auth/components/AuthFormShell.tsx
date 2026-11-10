import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound } from 'lucide-react'

type FooterLink = {
  label: string
  to: string
}

type AuthFormShellProps = {
  /** Kept for the callers; the new design shows the icon instead of an eyebrow. */
  eyebrow?: string
  title: string
  description: string
  icon?: ReactNode
  footerLinks?: FooterLink[]
  children: ReactNode
}

/** Heading block of an auth card: icon tile, title, one-line description, then the form. */
export function AuthFormShell({ title, description, icon, footerLinks = [], children }: AuthFormShellProps) {
  return (
    <div className="w-full">
      <span className="grid h-12 w-12 place-items-center rounded-[15px] bg-[var(--blue-dim)] text-[var(--primary)] ring-1 ring-[var(--blue-border)]">
        {icon ?? <KeyRound size={22} strokeWidth={2} />}
      </span>
      <h2 className="mt-5 text-[26px] leading-tight font-bold tracking-[-0.035em] text-[var(--foreground)]">{title}</h2>
      {description ? <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--muted)]">{description}</p> : null}

      <div className="mt-6">{children}</div>

      {footerLinks.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-4">
          {footerLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="text-[12.5px] font-semibold text-[var(--primary)] transition-colors hover:text-[var(--primary-hover)]"
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}

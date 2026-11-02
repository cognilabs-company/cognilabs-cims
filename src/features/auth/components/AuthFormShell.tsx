import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

type FooterLink = {
  label: string
  to: string
}

type AuthFormShellProps = {
  eyebrow: string
  title: string
  description: string
  footerLinks?: FooterLink[]
  children: ReactNode
}

export function AuthFormShell({
  eyebrow,
  title,
  description,
  footerLinks = [],
  children,
}: AuthFormShellProps) {
  return (
    <div className="w-full">
      <div className="space-y-2">
        <p className="ui-eyebrow text-[var(--primary)]">{eyebrow}</p>
        <h2 className="ui-page-title text-[var(--foreground)]">{title}</h2>
        {description ? <p className="text-sm text-[var(--muted)]">{description}</p> : null}
      </div>

      <div className="mt-[22px]">{children}</div>

      {footerLinks.length > 0 ? (
        <div className="mt-[18px] flex flex-wrap gap-4">
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

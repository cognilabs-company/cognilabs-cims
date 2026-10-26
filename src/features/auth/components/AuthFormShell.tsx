import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '../../../shared/ui/card'

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
  description: _description,
  footerLinks = [],
  children,
}: AuthFormShellProps) {
  return (
    <Card className="auth-login-shell overflow-hidden border-[var(--border)] bg-[var(--card)] p-0 shadow-sm">
      <div className="border-b border-[var(--border)] px-6 py-6 sm:px-7">
        <div className="space-y-2">
          <p className="ui-eyebrow text-[var(--muted)]">{eyebrow}</p>
          <h2 className="ui-dialog-title text-[var(--foreground)]">{title}</h2>
        </div>
      </div>

      <div className="px-6 py-6 sm:px-7">{children}</div>

      {footerLinks.length > 0 ? (
        <div className="border-t border-[var(--border)] px-6 py-4 sm:px-7">
          <div className="flex flex-wrap gap-3">
          {footerLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="ui-helper font-medium text-[var(--muted)] transition hover:text-[var(--foreground)]"
            >
              {link.label}
            </Link>
          ))}
          </div>
        </div>
      ) : null}
    </Card>
  )
}

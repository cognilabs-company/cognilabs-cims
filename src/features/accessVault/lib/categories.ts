import { Cloud, CreditCard, Globe, KeyRound, Mail, Server, Share2, Wrench, type LucideIcon } from 'lucide-react'

export type VaultCategory = { value: string; labelKey: string; fallback: string; icon: LucideIcon; color: string }

/** Kinds of access the company keeps. Unknown backend categories fall back to "Other". */
export const VAULT_CATEGORIES: VaultCategory[] = [
  { value: 'server', labelKey: 'vault.category.server', fallback: 'Servers & SSH', icon: Server, color: '#2B59FF' },
  { value: 'hosting', labelKey: 'vault.category.hosting', fallback: 'Hosting & domains', icon: Cloud, color: '#0EA5E9' },
  { value: 'social', labelKey: 'vault.category.social', fallback: 'Social media', icon: Share2, color: '#E1306C' },
  { value: 'email', labelKey: 'vault.category.email', fallback: 'Email', icon: Mail, color: '#F59E0B' },
  { value: 'service', labelKey: 'vault.category.service', fallback: 'Services & APIs', icon: Wrench, color: '#8B5CF6' },
  { value: 'website', labelKey: 'vault.category.website', fallback: 'Websites & admin panels', icon: Globe, color: '#16A34A' },
  { value: 'finance', labelKey: 'vault.category.finance', fallback: 'Banking & payments', icon: CreditCard, color: '#DC2626' },
  { value: 'other', labelKey: 'vault.category.other', fallback: 'Other', icon: KeyRound, color: '#64748B' },
]

export function categoryOf(value: string | null | undefined): VaultCategory {
  const key = (value ?? '').toLowerCase().trim()
  return VAULT_CATEGORIES.find((category) => category.value === key) ?? VAULT_CATEGORIES[VAULT_CATEGORIES.length - 1]
}

/** A strong random password (no look-alike characters). */
export function generatePassword(length = 20) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_=+'
  const bytes = new Uint32Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

/** "https://admin.example.com/login" → "admin.example.com" */
export function hostOf(url: string | null) {
  if (!url) return null
  try {
    return new URL(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`).host || url
  } catch {
    return url
  }
}

export function hrefOf(url: string) {
  return /^[a-z]+:\/\//i.test(url) ? url : `https://${url}`
}

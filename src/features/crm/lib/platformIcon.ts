import { Facebook, Globe, Instagram, Linkedin, MessageCircle, Phone, Send, Youtube, type LucideIcon } from 'lucide-react'

/** Icon + brand colour for a lead source shown in the Customers table. */
export function platformVisual(value: string): { icon: LucideIcon; color: string } {
  const key = value.toLowerCase()
  if (key.includes('insta')) return { icon: Instagram, color: '#E1306C' }
  if (key.includes('telegram') || key === 'tg') return { icon: Send, color: '#229ED9' }
  if (key.includes('facebook') || key === 'fb') return { icon: Facebook, color: '#1877F2' }
  if (key.includes('youtube')) return { icon: Youtube, color: '#FF0033' }
  if (key.includes('linkedin')) return { icon: Linkedin, color: '#0A66C2' }
  if (key.includes('phone') || key.includes('call') || key.includes('tel')) return { icon: Phone, color: '#17924A' }
  if (key.includes('web') || key.includes('site') || key.includes('sayt')) return { icon: Globe, color: '#2B59FF' }
  return { icon: MessageCircle, color: '#8A90A2' }
}

import { useCallback, useMemo, useState, type PropsWithChildren, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { translateCurrentLiteral } from '../i18n/translations'
import { cn } from '../lib/cn'
import { Button } from '../ui/button'
import { toneDot, tonePill, toneText, type Tone } from '../ui/tone'
import { ToastContext, type ToastInput } from './ToastContext'

type ToastItem = ToastInput & {
  id: number
}

type ToastTone = 'success' | 'error' | 'info'

const toneIcons: Record<ToastTone, ReactNode> = {
  success: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4.5 w-4.5" aria-hidden="true">
      <path d="m5 10 3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  error: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4.5 w-4.5" aria-hidden="true">
      <path d="M10 6v4m0 4h.01M10 2.5l7 12.5H3l7-12.5Z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  info: (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4.5 w-4.5" aria-hidden="true">
      <path d="M10 6.75h.01M9.25 9.5h.75v3h.75" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="10" cy="10" r="7" />
    </svg>
  ),
}

const toastTones: Record<ToastTone, Tone> = {
  success: 'success',
  error: 'danger',
  info: 'blue',
}

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const removeToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const showToast = useCallback((input: ToastInput) => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setToasts((current) => [...current, { id, ...input }])

    window.setTimeout(() => {
      removeToast(id)
    }, 3600)
  }, [removeToast])

  const contextValue = useMemo(() => ({ showToast }), [showToast])

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed top-[18px] right-[18px] z-[90] flex w-[min(92vw,420px)] flex-col gap-[18px]">
          {toasts.map((toast) => {
            const tone = toast.tone ?? 'info'
            const designTone = toastTones[tone]
            const localizedTone = translateCurrentLiteral(tone)
            const localizedTitle = translateCurrentLiteral(toast.title)
            const localizedDescription = toast.description ? translateCurrentLiteral(toast.description) : null

            return (
              <div
                key={toast.id}
                className="pointer-events-auto relative overflow-hidden rounded-[18px] bg-[var(--surface)] py-4 pr-4 pl-[18px] shadow-[var(--elev-lg)]"
              >
                <span className={cn('absolute inset-y-0 left-0 w-1', toneDot[designTone])} aria-hidden="true" />
                <div className="flex items-start gap-3">
                  <div className={cn('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[11px]', tonePill(designTone))}>
                    {toneIcons[tone]}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[11px] font-semibold uppercase tracking-[0.08em]', toneText[designTone])}>
                      {localizedTone}
                    </p>
                    <p className="mt-1 text-sm font-semibold tracking-[-0.01em] text-[var(--foreground)]">{localizedTitle}</p>
                    {localizedDescription ? (
                      <p className="mt-1 text-[12.5px] leading-5 text-[var(--muted)]">{localizedDescription}</p>
                    ) : null}
                  </div>

                  <Button variant="ghost" size="sm" className="shrink-0" onClick={() => removeToast(toast.id)}>
                    {translateCurrentLiteral('Close')}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

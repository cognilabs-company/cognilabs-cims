import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../features/auth/hooks/useAuth'
import { CimsAiProvider } from '../../features/ceo/context/CimsAiContext'
import { translateCurrentLiteral } from '../../shared/i18n/translations'
import { cn } from '../../shared/lib/cn'
import { AsyncContentLoader } from '../../shared/ui/async-content-loader'
import { NavGlyph } from '../navigation/NavGlyph'

async function loadCimsAiWorkspace() {
  const module = await import('../../features/ceo/components/CimsAiWorkspace')

  return {
    default: module.CimsAiWorkspace,
  }
}

const CimsAiWorkspace = lazy(loadCimsAiWorkspace)

export function CimsAiLauncher() {
  const location = useLocation()
  const { hasPermission, isAuthenticated } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  const canUseAi = isAuthenticated && hasPermission('ceo')
  // Hidden on full-screen AI pages: the CEO AI page itself and the messenger, where it would cover the send button
  const isAiPage = location.pathname === '/ceo/ai' || location.pathname.startsWith('/cognilabsai/chat')

  function preloadWorkspace() {
    void loadCimsAiWorkspace()
  }

  useEffect(() => {
    if (!isOpen) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null

      if (
        target &&
        !cardRef.current?.contains(target) &&
        !buttonRef.current?.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  if (!canUseAi || isAiPage) {
    return null
  }

  return (
    <>
      <button
        type="button"
        aria-label={translateCurrentLiteral('Close CIMS AI backdrop')}
        onClick={() => setIsOpen(false)}
        className={cn(
          'dialog-backdrop fixed inset-0 z-[64] transition-opacity duration-200',
          isOpen
            ? 'pointer-events-auto opacity-100'
            : 'pointer-events-none opacity-0',
        )}
      />

      <div
        ref={cardRef}
        className={cn(
          'fixed bottom-24 right-4 z-[65] w-[min(calc(100vw-2rem),500px)] transition-all duration-200 sm:right-6',
          isOpen
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-3 opacity-0',
        )}
      >
        <div data-ui-surface="true" className="overflow-hidden rounded-[24px] bg-[var(--surface)] shadow-[var(--elev-xl)]">
          <div className="h-[min(84vh,780px)]">
            {isOpen ? (
              <Suspense fallback={<AsyncContentLoader variant="dialog" />}>
                <CimsAiProvider>
                  <CimsAiWorkspace mode="dialog" />
                </CimsAiProvider>
              </Suspense>
            ) : null}
          </div>
        </div>
      </div>

      <button
        ref={buttonRef}
        type="button"
        onMouseEnter={preloadWorkspace}
        onFocus={preloadWorkspace}
        onClick={() => {
          if (!isOpen) {
            preloadWorkspace()
          }

          setIsOpen((current) => !current)
        }}
        className="fixed bottom-6 right-4 z-[66] grid h-14 w-14 place-items-center rounded-[18px] bg-[var(--primary)] text-white shadow-[var(--elev-primary)] transition-[background-color,transform,box-shadow] duration-150 hover:scale-[1.02] hover:bg-[var(--primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--primary)]/35 focus-visible:outline-none sm:right-6"
        aria-label={isOpen ? translateCurrentLiteral('Close CIMS AI launcher') : translateCurrentLiteral('Open CIMS AI launcher')}
      >
        <NavGlyph name="ai" className="h-6 w-6 text-current" aria-hidden="true" />
      </button>
    </>
  )
}

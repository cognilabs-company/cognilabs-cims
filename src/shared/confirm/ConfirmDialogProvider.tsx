import { useRef, useState, type PropsWithChildren } from 'react'
import {
  ConfirmDialogContext,
  type ConfirmOptions,
} from './ConfirmDialogContext'
import { translateCurrentLiteral } from '../i18n/translations'
import { Button } from '../ui/button'
import { Dialog } from '../ui/dialog'

function DangerHeaderIcon() {
  return (
    <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/30 bg-[linear-gradient(180deg,rgba(127,29,29,0.92),rgba(69,10,10,0.96))] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_16px_32px_rgba(127,29,29,0.28)]">
      <span className="ui-dialog-title font-bold leading-none text-red-400">!</span>
    </div>
  )
}

export function ConfirmDialogProvider({ children }: PropsWithChildren) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  function closeWith(result: boolean) {
    resolverRef.current?.(result)
    resolverRef.current = null
    setOptions(null)
  }

  function confirm(nextOptions: ConfirmOptions) {
    setOptions(nextOptions)

    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      <Dialog
        open={Boolean(options)}
        onClose={() => closeWith(false)}
        title={translateCurrentLiteral(options?.title ?? 'Confirm action')}
        description={options?.description}
        tone={options?.tone ?? 'default'}
        eyebrow={translateCurrentLiteral(options?.tone === 'danger' ? 'Danger zone' : 'Workspace dialog')}
        headerIcon={options?.tone === 'danger' ? <DangerHeaderIcon /> : undefined}
        footer={
          <>
            <Button variant="secondary" className="min-w-[96px]" onClick={() => closeWith(false)}>
              {translateCurrentLiteral(options?.cancelLabel ?? 'Cancel')}
            </Button>
            <Button
              variant={options?.tone === 'danger' ? 'danger' : 'primary'}
              className={
                options?.tone === 'danger'
                  ? 'min-w-[156px] border-red-500/40 bg-[linear-gradient(180deg,#dc2626,#b91c1c)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_12px_24px_rgba(127,29,29,0.28)] hover:border-red-400/60 hover:bg-[linear-gradient(180deg,#ef4444,#dc2626)] hover:text-white'
                  : 'min-w-[132px]'
              }
              onClick={() => closeWith(true)}
            >
              {translateCurrentLiteral(options?.confirmLabel ?? 'Confirm')}
            </Button>
          </>
        }
      />
    </ConfirmDialogContext.Provider>
  )
}

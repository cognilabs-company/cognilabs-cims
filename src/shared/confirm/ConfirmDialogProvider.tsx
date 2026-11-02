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
    <div className="grid h-11 w-11 place-items-center rounded-[14px] bg-[var(--danger-dim)]">
      <span className="ui-dialog-title font-bold leading-none text-[var(--danger-text)]">!</span>
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
              className={options?.tone === 'danger' ? 'min-w-[156px]' : 'min-w-[132px]'}
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

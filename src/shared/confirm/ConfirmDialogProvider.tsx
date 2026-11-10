import { useRef, useState, type PropsWithChildren } from 'react'
import {
  ConfirmDialogContext,
  type ConfirmOptions,
} from './ConfirmDialogContext'
import { translateCurrent, translateCurrentLiteral } from '../i18n/translations'
import { Button } from '../ui/button'
import { Dialog } from '../ui/dialog'
import { CircleHelp, TriangleAlert } from 'lucide-react'

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
        headerIcon={options?.tone === 'danger' ? <TriangleAlert /> : <CircleHelp />}
        className="sm:max-w-[420px]"
        footer={
          <>
            <Button variant="secondary" onClick={() => closeWith(false)}>
              {options?.cancelLabel ? translateCurrentLiteral(options.cancelLabel) : translateCurrent('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant={options?.tone === 'danger' ? 'danger' : 'primary'}
              autoFocus
              className={options?.tone === 'danger' ? 'bg-[var(--danger)] text-white hover:bg-[var(--danger)] hover:brightness-110 active:bg-[var(--danger)]' : undefined}
              onClick={() => closeWith(true)}
            >
              {options?.confirmLabel ? translateCurrentLiteral(options.confirmLabel) : translateCurrent('common.confirm', 'Confirm')}
            </Button>
          </>
        }
      />
    </ConfirmDialogContext.Provider>
  )
}

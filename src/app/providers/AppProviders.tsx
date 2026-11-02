import { RouterProvider } from 'react-router-dom'
import { ConfirmDialogProvider } from '../../shared/confirm/ConfirmDialogProvider'
import { ToastProvider } from '../../shared/toast/ToastProvider'
import { router } from '../router'
import { LocaleProvider } from './LocaleProvider'

export function AppProviders() {
  return (
    <LocaleProvider>
      <ToastProvider>
        <ConfirmDialogProvider>
          <RouterProvider router={router} />
        </ConfirmDialogProvider>
      </ToastProvider>
    </LocaleProvider>
  )
}

import { Navigate, useLocation } from 'react-router-dom'

/** Old URL → merged page with the right tab, keeping ?year=…&month=… and the like. */
export function RedirectKeepingQuery({ to, tab }: { to: string; tab: string }) {
  const { search } = useLocation()
  const query = new URLSearchParams(search)
  query.set('tab', tab)
  return <Navigate to={`${to}?${query.toString()}`} replace />
}

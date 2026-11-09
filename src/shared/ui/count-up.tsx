import { useCountUp } from '../hooks/useCountUp'

/** A number that counts up to its value (eases out; instant with reduced motion). */
export function CountUp({ value, format }: { value: number; format?: (value: number) => string }) {
  const current = useCountUp(value)
  return <>{format ? format(current) : Math.round(current).toLocaleString()}</>
}

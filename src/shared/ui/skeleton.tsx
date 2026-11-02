import { cn } from '../lib/cn'

type SkeletonProps = {
  className?: string
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

const radii = {
  sm: 'rounded-[9px]',
  md: 'rounded-[11px]',
  lg: 'rounded-[14px]',
  xl: 'rounded-[18px]',
  full: 'rounded-full',
}

export function Skeleton({ className, rounded = 'md' }: SkeletonProps) {
  return <div className={cn('skeleton', radii[rounded], className)} aria-hidden="true" />
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('flex flex-col gap-2', className)} aria-hidden="true">
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          rounded="full"
          className={cn('h-3', index === lines - 1 ? 'w-2/5' : 'w-full')}
        />
      ))}
    </div>
  )
}

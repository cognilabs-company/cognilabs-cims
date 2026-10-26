import { Transport as TransportPrimitive } from '@audio-ui/react'
import { cva, type VariantProps } from 'class-variance-authority'
import type React from 'react'
import { cn } from '@/shared/lib/cn'

const transportSliderVariants = cva('', {
  variants: { size: { sm: '', default: '', lg: '' } },
  defaultVariants: { size: 'default' },
})

const transportTrackVariants = cva(
  'relative grow cursor-pointer select-none overflow-hidden rounded-full bg-input/90',
  {
    variants: { size: { sm: '', default: '', lg: '' } },
    compoundVariants: [
      { size: 'sm', class: 'data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full' },
      { size: 'default', class: 'data-[orientation=horizontal]:h-2 data-[orientation=horizontal]:w-full' },
      { size: 'lg', class: 'data-[orientation=horizontal]:h-2.5 data-[orientation=horizontal]:w-full' },
    ],
    defaultVariants: { size: 'default' },
  }
)

const transportThumbVariants = cva(
  'before:-inset-2 absolute z-10 block shrink-0 cursor-grab select-none rounded-full bg-white shadow-md ring-1 ring-black/10 transition-[color,box-shadow,background-color] before:absolute before:content-[\'\'] hover:ring-4 hover:ring-ring/30 focus-visible:outline-hidden focus-visible:ring-4 focus-visible:ring-ring/30 active:cursor-grabbing data-[disabled=true]:pointer-events-none data-[disabled=true]:cursor-not-allowed motion-reduce:transition-none',
  {
    variants: { size: { sm: '', default: '', lg: '' } },
    compoundVariants: [
      { size: 'sm', class: 'data-[orientation=horizontal]:h-3.5 data-[orientation=horizontal]:w-5' },
      { size: 'default', class: 'data-[orientation=horizontal]:h-4 data-[orientation=horizontal]:w-6' },
      { size: 'lg', class: 'data-[orientation=horizontal]:h-5 data-[orientation=horizontal]:w-7' },
    ],
    defaultVariants: { size: 'default' },
  }
)

const transportThumbMarkVariants = cva('bg-primary opacity-50', {
  variants: { size: { sm: '', default: '', lg: '' } },
  compoundVariants: [
    { size: 'sm', class: 'data-[orientation=horizontal]:h-2.5 data-[orientation=horizontal]:w-px' },
    { size: 'default', class: 'data-[orientation=horizontal]:h-2.5 data-[orientation=horizontal]:w-px' },
    { size: 'lg', class: 'data-[orientation=horizontal]:h-3 data-[orientation=horizontal]:w-px' },
  ],
  defaultVariants: { size: 'default' },
})

type TransportProps = Omit<
  React.ComponentProps<typeof TransportPrimitive.Root>,
  'value' | 'onValueChange' | 'bufferedValue'
> & {
  value: number
  bufferedValue?: number
  onSeek: (nextValue: number) => void
} & VariantProps<typeof transportSliderVariants>

function Transport({ value, bufferedValue, onSeek, size, min = 0, max = 100, className, orientation, ...props }: TransportProps) {
  return (
    <TransportPrimitive.Root
      bufferedValue={bufferedValue}
      className={cn('relative data-[orientation=horizontal]:w-full', className)}
      max={max}
      min={min}
      onValueChange={onSeek}
      orientation={orientation}
      value={value}
      {...props}
    >
      <TransportPrimitive.Slider
        className={cn(
          'relative flex w-full touch-none select-none items-center data-disabled:opacity-50',
          'data-[orientation=horizontal]:w-full data-[orientation=horizontal]:min-w-32',
          transportSliderVariants({ size })
        )}
      >
        <TransportPrimitive.Track className={transportTrackVariants({ size })}>
          <TransportPrimitive.BufferedRange
            className="absolute inset-y-0 left-0 z-0 select-none bg-primary/40"
          />
          <TransportPrimitive.Range
            className="absolute inset-y-0 left-0 select-none bg-primary"
          />
        </TransportPrimitive.Track>
        <TransportPrimitive.Thumb className={transportThumbVariants({ size })}>
          <TransportPrimitive.ThumbInner className="flex h-full w-full items-center justify-center data-[orientation=horizontal]:flex-row data-[orientation=horizontal]:px-1.5 data-[orientation=horizontal]:py-1">
            <TransportPrimitive.ThumbMark className={transportThumbMarkVariants({ size })} />
          </TransportPrimitive.ThumbInner>
        </TransportPrimitive.Thumb>
      </TransportPrimitive.Slider>
    </TransportPrimitive.Root>
  )
}

export { Transport }

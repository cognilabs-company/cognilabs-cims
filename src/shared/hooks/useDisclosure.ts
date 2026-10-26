import { useState } from 'react'

export function useDisclosure(defaultOpen = false) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  function open() {
    setIsOpen(true)
  }

  function close() {
    setIsOpen(false)
  }

  function toggle() {
    setIsOpen((current) => !current)
  }

  return {
    isOpen,
    open,
    close,
    toggle,
  }
}

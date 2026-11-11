import { useCallback, useEffect, useRef, useState } from 'react'
import { newUid } from './fields'
import type { FormFiles } from './values'

/**
 * Files chosen per field. Image previews are object URLs created when a file is picked and
 * revoked when it is removed or the form goes away.
 */
export function usePickedFiles() {
  const [files, setFiles] = useState<FormFiles>({})
  const filesRef = useRef<FormFiles>({})
  const urlsRef = useRef(new Set<string>())

  useEffect(() => {
    filesRef.current = files
  }, [files])

  useEffect(() => {
    const urls = urlsRef.current
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url))
      urls.clear()
    }
  }, [])

  const add = useCallback((key: string, list: File[]) => {
    const picked = list.map((file) => {
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null
      if (preview) urlsRef.current.add(preview)
      return { id: newUid(), file, preview }
    })
    setFiles((current) => ({ ...current, [key]: [...(current[key] ?? []), ...picked] }))
  }, [])

  const remove = useCallback((key: string, id: string) => {
    const preview = filesRef.current[key]?.find((item) => item.id === id)?.preview
    setFiles((current) => ({ ...current, [key]: (current[key] ?? []).filter((item) => item.id !== id) }))
    if (preview) {
      urlsRef.current.delete(preview)
      // After React has dropped the <img>, so it never shows a broken image.
      window.setTimeout(() => URL.revokeObjectURL(preview), 0)
    }
  }, [])

  return { files, add, remove }
}

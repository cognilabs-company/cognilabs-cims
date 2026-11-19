/* Check-in / check-out photo: the backend takes JPEG, PNG or WebP up to 10 MB and stores its own resized JPEG. */

const SUPPORTED = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024
/** Small enough to upload as is on a phone connection. */
const SEND_AS_IS_BYTES = 2.5 * 1024 * 1024
const MAX_EDGE = 1600

export type PhotoError = 'unsupported' | 'too_large'

export class PhotoPrepError extends Error {
  readonly code: PhotoError
  constructor(code: PhotoError) {
    super(code)
    this.code = code
  }
}

function decode(file: Blob): Promise<CanvasImageSource & { width: number; height: number }> {
  if ('createImageBitmap' in window) {
    return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => decodeWithImg(file))
  }
  return decodeWithImg(file)
}

function decodeWithImg(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('decode')) }
    img.src = url
  })
}

/**
 * A camera photo ready for upload: small JPEG/PNG/WebP files go as they are; anything else
 * (HEIC, very large shots) is redrawn as a JPEG of at most 1600 px on the long edge.
 */
export async function preparePhoto(file: File): Promise<Blob> {
  if (SUPPORTED.includes(file.type) && file.size <= SEND_AS_IS_BYTES) return file
  let image: CanvasImageSource & { width: number; height: number }
  try {
    image = await decode(file)
  } catch {
    // Could not redraw it: a supported file within the limit still goes as it is.
    if (SUPPORTED.includes(file.type) && file.size <= MAX_BYTES) return file
    throw new PhotoPrepError(SUPPORTED.includes(file.type) ? 'too_large' : 'unsupported')
  }
  const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.width * scale))
  canvas.height = Math.max(1, Math.round(image.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new PhotoPrepError('unsupported')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  if ('close' in image && typeof image.close === 'function') image.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
  if (!blob) throw new PhotoPrepError('unsupported')
  if (blob.size > MAX_BYTES) throw new PhotoPrepError('too_large')
  return blob
}

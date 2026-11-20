/*
 * In-app camera for the check-in / check-out photo. A file input with `capture` opens only the
 * gallery in some Telegram clients (Android), so the camera is opened directly with getUserMedia
 * and a frame is taken from the live video. The file input stays as the fallback.
 */

export type CameraFacing = 'user' | 'environment'
export type CameraProblem = 'denied' | 'busy' | 'unavailable'

export class CameraError extends Error {
  readonly problem: CameraProblem
  constructor(problem: CameraProblem) {
    super(problem)
    this.problem = problem
  }
}

const MAX_EDGE = 1600

export function cameraSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function' && window.isSecureContext !== false
}

function problemOf(cause: unknown): CameraProblem | null {
  const name = (cause as { name?: unknown } | null)?.name
  if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied'
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') return 'busy'
  return null
}

/** Opens the camera (front by default). Rejects with a CameraError. */
export async function openCamera(facing: CameraFacing): Promise<MediaStream> {
  if (!cameraSupported()) throw new CameraError('unavailable')
  const ask = (video: MediaTrackConstraints | true) => navigator.mediaDevices.getUserMedia({ audio: false, video })
  try {
    return await ask({ facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 1280 } })
  } catch (cause) {
    const problem = problemOf(cause)
    if (problem) throw new CameraError(problem)
    // Constraints the device cannot meet (or an unknown error): any camera will do.
    try {
      return await ask(true)
    } catch (again) {
      throw new CameraError(problemOf(again) ?? 'unavailable')
    }
  }
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => {
    try { track.stop() } catch { /* already stopped */ }
  })
}

/** The current video frame as a JPEG file (at most 1600 px on the long edge). Mirrored like the preview for the front camera. */
export async function grabFrame(video: HTMLVideoElement, mirror: boolean): Promise<File> {
  const width = video.videoWidth
  const height = video.videoHeight
  if (!width || !height) throw new CameraError('unavailable')
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new CameraError('unavailable')
  if (mirror) {
    context.translate(canvas.width, 0)
    context.scale(-1, 1)
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88))
  if (!blob) throw new CameraError('unavailable')
  return new File([blob], `attendance-${new Date().getTime()}.jpg`, { type: 'image/jpeg' })
}

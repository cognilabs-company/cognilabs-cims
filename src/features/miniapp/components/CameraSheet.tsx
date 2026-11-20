import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../../app/hooks/useLocale'
import { cn } from '../../../shared/lib/cn'
import { CameraError, grabFrame, openCamera, stopStream, type CameraFacing, type CameraProblem } from '../lib/camera'
import { haptic, useTelegramBack } from '../lib/telegram'
import { IcArrive, IcCamera, IcClose, IcFlip, IcImage, IcLeave, IcRefresh, IcWarning } from '../ui/icons'
import { Arcs } from '../ui/motion'

type Props = {
  /** Checked in already → the photo is for "Ketdim". */
  leaving: boolean
  /** The Mini App is on screen; the camera is released while it is in the background. */
  appVisible: boolean
  onClose: () => void
  onPhoto: (file: File) => void
  onWithoutPhoto: () => void
}

type Live = { key: string; status: 'ready' } | { key: string; status: 'error'; problem: CameraProblem }

/**
 * Full-screen selfie camera for the attendance photo: live preview with a face guide, shutter with a flash,
 * retake / send. When the camera cannot be opened, the phone's own camera (file input) and "without photo" remain.
 */
export function CameraSheet({ leaving, appVisible, onClose, onPhoto, onWithoutPhoto }: Props) {
  const { t } = useLocale()
  const [facing, setFacing] = useState<CameraFacing>('user')
  const [session, setSession] = useState(0)
  const [live, setLive] = useState<Live | null>(null)
  const [shot, setShot] = useState<{ file: File; url: string } | null>(null)
  const [flash, setFlash] = useState(0)
  const [capturing, setCapturing] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const pickerRef = useRef<HTMLInputElement>(null)

  useTelegramBack(true, onClose)

  const key = `${facing}-${session}-${appVisible ? 1 : 0}`
  const status: 'starting' | 'ready' | 'error' = !appVisible ? 'starting' : live?.key === key ? live.status : 'starting'
  const problem = live?.key === key && live.status === 'error' ? live.problem : null

  // The camera runs only while the preview is needed (no shot yet, app on screen).
  useEffect(() => {
    if (shot || !appVisible) return
    const video = videoRef.current
    let alive = true
    let stream: MediaStream | null = null
    openCamera(facing)
      .then((opened) => {
        if (!alive) { stopStream(opened); return }
        stream = opened
        if (video) {
          video.srcObject = opened
          void video.play().catch(() => { /* autoplay is muted, it starts on the next frame */ })
        }
        setLive({ key, status: 'ready' })
      })
      .catch((cause: unknown) => {
        if (alive) setLive({ key, status: 'error', problem: cause instanceof CameraError ? cause.problem : 'unavailable' })
      })
    return () => {
      alive = false
      stopStream(stream)
      if (video) video.srcObject = null
    }
  }, [facing, session, appVisible, shot, key])

  // The preview of a taken shot lives in memory only.
  useEffect(() => () => { if (shot) URL.revokeObjectURL(shot.url) }, [shot])

  async function capture() {
    const video = videoRef.current
    if (!video || status !== 'ready' || capturing) return
    haptic('tap')
    setCapturing(true)
    setFlash((value) => value + 1)
    try {
      const file = await grabFrame(video, facing === 'user')
      setShot({ file, url: URL.createObjectURL(file) })
      haptic('success')
    } catch {
      haptic('error')
      setLive({ key, status: 'error', problem: 'unavailable' })
    } finally {
      setCapturing(false)
    }
  }

  function retake() {
    haptic('select')
    setShot(null)
    setSession((value) => value + 1)
  }

  const ActionIcon = leaving ? IcLeave : IcArrive
  const problemTitle = problem === 'denied'
    ? t('miniapp.cam.denied', 'Camera access is blocked')
    : problem === 'busy'
      ? t('miniapp.cam.busy', 'The camera is busy in another app')
      : t('miniapp.cam.unavailable', 'Could not open the camera')
  const problemText = problem === 'denied'
    ? t('miniapp.cam.denied_hint', 'Allow the camera for Telegram in your phone settings, or take the photo with the phone camera.')
    : t('miniapp.cam.unavailable_hint', 'Try again or take the photo with the phone camera.')

  return (
    <div className="m-fade fixed inset-0 z-[70] flex flex-col bg-[#07080a] text-white" role="dialog" aria-modal="true" aria-label={t('miniapp.cam.title', 'Take a photo')}>
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 pt-[max(14px,env(safe-area-inset-top))] pb-3">
        <button type="button" onClick={onClose} aria-label={t('common.close', 'Close')} className="m-press grid h-11 w-11 place-items-center rounded-full bg-white/10 backdrop-blur">
          <IcClose size={20} />
        </button>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-[16px] font-bold">{t('miniapp.cam.title', 'Take a photo')}</p>
          <p className="truncate text-[12px] font-semibold text-white/55">{leaving ? t('miniapp.att.check_out', 'Ketdim') : t('miniapp.att.check_in', 'Keldim')}</p>
        </div>
        <button
          type="button"
          onClick={() => { haptic('select'); setFacing((value) => (value === 'user' ? 'environment' : 'user')) }}
          disabled={Boolean(shot) || status !== 'ready'}
          aria-label={t('miniapp.cam.flip', 'Switch camera')}
          className="m-press grid h-11 w-11 place-items-center rounded-full bg-white/10 backdrop-blur disabled:opacity-30"
        >
          <IcFlip size={20} />
        </button>
      </div>

      {/* Viewport */}
      <div className="relative mx-3 flex-1 overflow-hidden rounded-[34px] bg-[#111316]">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={cn('absolute inset-0 h-full w-full object-cover transition-opacity duration-500', facing === 'user' && '-scale-x-100', status === 'ready' && !shot ? 'opacity-100' : 'opacity-0')}
        />
        {shot ? <img src={shot.url} alt="" className="m-fade absolute inset-0 h-full w-full object-cover" /> : null}

        {/* Face guide */}
        {!shot && status === 'ready' ? (
          <svg className="m-fade pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <defs>
              <mask id="m-face-hole">
                <rect width="100" height="140" fill="white" />
                <ellipse cx="50" cy="62" rx="28" ry="37" fill="black" />
              </mask>
            </defs>
            <rect width="100" height="140" fill="rgba(0,0,0,0.38)" mask="url(#m-face-hole)" />
            <ellipse className="m-guide" cx="50" cy="62" rx="28" ry="37" fill="none" stroke="var(--m-lime)" strokeWidth="0.8" />
          </svg>
        ) : null}

        {status === 'starting' && !shot ? (
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex flex-col items-center gap-3 text-white/80">
              <Arcs size={34} className="text-[var(--m-lime)]" />
              <p className="text-[13.5px] font-semibold">{t('miniapp.cam.starting', 'Starting the camera…')}</p>
            </div>
          </div>
        ) : null}

        {status === 'error' && !shot ? (
          <div className="m-rise absolute inset-0 flex flex-col items-center justify-center px-7 text-center">
            <span className="grid h-16 w-16 place-items-center rounded-[22px] bg-white/10 text-[var(--m-coral)]">
              <IcWarning size={30} duo={0.25} />
            </span>
            <p className="mt-4 text-[18px] font-bold">{problemTitle}</p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-white/65">{problemText}</p>
            <div className="mt-5 flex w-full max-w-[290px] flex-col gap-2">
              <button type="button" onClick={() => { haptic('tap'); pickerRef.current?.click() }} className="m-press flex h-12 items-center justify-center gap-2 rounded-full bg-[var(--m-lime)] text-[15px] font-bold text-[var(--m-lime-ink)]">
                <IcImage size={19} /> {t('miniapp.cam.system', 'Open the phone camera')}
              </button>
              {problem !== 'denied' ? (
                <button type="button" onClick={() => { haptic('select'); setSession((value) => value + 1) }} className="m-press flex h-11 items-center justify-center gap-2 rounded-full bg-white/10 text-[14px] font-semibold">
                  <IcRefresh size={17} /> {t('miniapp.retry', 'Try again')}
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {flash ? <span key={flash} className="m-flash" /> : null}
      </div>

      {/* Bottom */}
      <div className="px-5 pt-4 pb-[max(18px,env(safe-area-inset-bottom))]">
        {shot ? (
          <div className="m-rise flex items-center gap-3">
            <button type="button" onClick={retake} className="m-press flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-white/10 text-[15px] font-bold">
              <IcRefresh size={19} /> {t('miniapp.cam.retake', 'Retake')}
            </button>
            <button
              type="button"
              onClick={() => { haptic('tap'); onPhoto(shot.file) }}
              className={cn('m-press flex h-14 flex-[1.4] items-center justify-center gap-2 rounded-full text-[15px] font-extrabold', leaving ? 'bg-[var(--m-coral)] text-white' : 'bg-[var(--m-lime)] text-[var(--m-lime-ink)]')}
            >
              <ActionIcon size={20} duo={0} /> {leaving ? t('miniapp.cam.send_out', 'Send · Ketdim') : t('miniapp.cam.send_in', 'Send · Keldim')}
            </button>
          </div>
        ) : status === 'error' ? (
          <button type="button" onClick={() => { haptic('tap'); onWithoutPhoto() }} className="m-rise m-press flex h-14 w-full items-center justify-center gap-2 rounded-full bg-white/10 text-[15px] font-bold">
            <ActionIcon size={19} duo={0} /> {t('miniapp.att.no_photo', 'Continue without photo')}
          </button>
        ) : (
          <>
            <p className="mb-4 text-center text-[13px] font-medium text-white/60">
              {t('miniapp.cam.hint', 'Keep your face inside the frame')}
            </p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-center">
              <span />
              <button
                type="button"
                onClick={() => void capture()}
                disabled={status !== 'ready' || capturing}
                aria-label={t('miniapp.cam.shutter', 'Take photo')}
                className="m-press group relative grid h-[82px] w-[82px] place-items-center rounded-full border-[4px] border-white/90 disabled:opacity-35"
              >
                <span className="grid h-[64px] w-[64px] place-items-center rounded-full bg-white text-[#07080a] transition-transform duration-200 group-active:scale-90">
                  <IcCamera size={26} duo={0} />
                </span>
              </button>
              <button type="button" onClick={() => { haptic('tap'); onWithoutPhoto() }} className="m-press justify-self-end rounded-full px-3 py-2 text-[13px] font-semibold text-white/70">
                {t('miniapp.cam.skip', 'No photo')}
              </button>
            </div>
          </>
        )}
      </div>

      {/* The phone's own camera (fallback) */}
      <input
        ref={pickerRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) onPhoto(file)
        }}
      />
    </div>
  )
}

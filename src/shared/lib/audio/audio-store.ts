import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { $htmlAudio, type Track } from '@/shared/lib/audio/html-audio'

type RepeatMode = 'none' | 'one' | 'all'
type InsertMode = 'first' | 'last' | 'after'

type AudioStore = {
  currentTrack: Track | null
  queue: Track[]
  isPlaying: boolean
  isLoading: boolean
  isBuffering: boolean
  volume: number
  isMuted: boolean
  playbackRate: number
  repeatMode: RepeatMode
  shuffleEnabled: boolean
  currentTime: number
  duration: number
  progress: number
  bufferedTime: number
  insertMode: InsertMode
  isError: boolean
  errorMessage: string | null
  currentQueueIndex: number

  play: () => void
  pause: () => void
  togglePlay: () => void
  next: () => void
  previous: () => void
  seek: (time: number) => void
  setQueueAndPlay: (tracks: Track[], startIndex: number) => void
  handleTrackEnd: () => void
  syncTime: (currentTime: number, duration: number) => void

  addToQueue: (track: Track, mode?: InsertMode) => void
  removeFromQueue: (trackId: string) => void
  clearQueue: () => void
  moveInQueue: (fromIndex: number, toIndex: number) => void
  setQueue: (tracks: Track[], startIndex?: number) => void
  getCurrentQueueIndex: () => number
  addTracksToEndOfQueue: (tracksToAdd: Track[]) => void

  setVolume: (params: { volume: number }) => void
  toggleMute: () => void
  setPlaybackRate: (rate: number) => void
  changeRepeatMode: () => void
  setInsertMode: (mode: InsertMode) => void
  shuffle: () => void
  unshuffle: () => void
  setRepeatMode: (mode: RepeatMode) => void

  setCurrentTrack: (track: Track | null) => void
  setError: (message: string | null) => void
}

function canUseDOM() {
  return !!(typeof window !== 'undefined' && window.document && window.document.createElement)
}

type QueueNavigationParams = {
  queue: Track[]
  currentQueueIndex: number
  shuffleEnabled: boolean
  repeatMode: RepeatMode
}

const getRandomShuffleIndex = ({ queueLength, currentIndex }: { queueLength: number; currentIndex: number }): number => {
  if (queueLength === 1) return 0
  let randomIndex: number
  do { randomIndex = Math.floor(Math.random() * queueLength) } while (randomIndex === currentIndex)
  return randomIndex
}

const calculateQueueIndex = ({ queue, currentQueueIndex, shuffleEnabled, repeatMode, direction }: QueueNavigationParams & { direction: 1 | -1 }): number => {
  if (queue.length === 0) return -1
  if (shuffleEnabled) {
    const singleTrackIndex = repeatMode === 'none' ? -1 : 0
    return queue.length === 1 ? singleTrackIndex : getRandomShuffleIndex({ queueLength: queue.length, currentIndex: currentQueueIndex })
  }
  const newIndex = currentQueueIndex + direction
  if (newIndex >= queue.length) return repeatMode === 'all' ? 0 : -1
  if (newIndex < 0) return repeatMode === 'all' ? queue.length - 1 : -1
  return newIndex
}

const calculateNextIndex = (params: QueueNavigationParams): number => calculateQueueIndex({ ...params, direction: 1 })
const calculatePreviousIndex = (params: QueueNavigationParams): number => calculateQueueIndex({ ...params, direction: -1 })

const getSuccessState = (params: { isPlaying?: boolean } = {}) => ({
  isLoading: false, isError: false, errorMessage: null, isBuffering: false, isPlaying: params.isPlaying ?? false,
})

type LoadAndPlayTrackParams = {
  track: Track
  queueIndex: number
  set: (partial: Partial<AudioStore>) => void
  get: () => AudioStore
}

const loadAndPlayTrack = ({ track, queueIndex, set, get }: LoadAndPlayTrackParams): void => {
  const isLiveStream = track.live === true || (track.duration !== undefined && $htmlAudio.isLive(track.duration))
  set({ currentTrack: track, currentQueueIndex: queueIndex, isLoading: true, isBuffering: true, isError: false, errorMessage: null })
  if (isLiveStream) {
    const currentState = get()
    if (currentState.playbackRate !== 1) set({ playbackRate: 1 })
  }
  set(getSuccessState({ isPlaying: true }))
}

const useAudioStore = create<AudioStore>()(
  persist(
    subscribeWithSelector((set, get) => ({
      currentTrack: null,
      queue: [],
      isPlaying: false,
      isLoading: false,
      isBuffering: false,
      volume: 1,
      isMuted: false,
      playbackRate: 1,
      repeatMode: 'none',
      shuffleEnabled: false,
      currentTime: 0,
      duration: 0,
      progress: 0,
      bufferedTime: 0,
      insertMode: 'last',
      isError: false,
      errorMessage: null,
      currentQueueIndex: -1,

      play() { if (!get().isLoading) set({ isPlaying: true }) },
      pause() { set({ isPlaying: false }) },
      togglePlay() { if (!get().isLoading) set({ isPlaying: !get().isPlaying }) },

      next() {
        const state = get()
        const nextIndex = calculateNextIndex({ queue: state.queue, currentQueueIndex: state.currentQueueIndex, shuffleEnabled: state.shuffleEnabled, repeatMode: state.repeatMode })
        const nextTrack = state.queue[nextIndex]
        if (nextIndex === -1 || !nextTrack) { set({ isLoading: false, isPlaying: false, isBuffering: false }); return }
        loadAndPlayTrack({ track: nextTrack, queueIndex: nextIndex, set, get })
      },

      previous() {
        const state = get()
        if (state.currentTime > 3 && !state.shuffleEnabled) { set({ currentTime: 0, progress: 0 }); return }
        const prevIndex = calculatePreviousIndex({ queue: state.queue, currentQueueIndex: state.currentQueueIndex, shuffleEnabled: state.shuffleEnabled, repeatMode: state.repeatMode })
        const prevTrack = state.queue[prevIndex]
        if (prevIndex === -1 || !prevTrack) { set({ isLoading: false, isPlaying: false, isBuffering: false }); return }
        loadAndPlayTrack({ track: prevTrack, queueIndex: prevIndex, set, get })
      },

      seek(time: number) {
        const { duration } = get()
        const validTime = duration > 0 ? Math.max(0, Math.min(time, duration)) : time
        set({ currentTime: validTime, progress: duration > 0 ? (validTime / duration) * 100 : 0 })
      },

      setQueueAndPlay(songs: Track[], startIndex: number) {
        const targetTrack = songs[startIndex]
        if (!targetTrack) { get().clearQueue(); set({ isPlaying: false, isLoading: false, currentTrack: null, currentQueueIndex: -1 }); return }
        get().setQueue(songs, startIndex)
        loadAndPlayTrack({ track: targetTrack, queueIndex: startIndex, set, get })
      },

      handleTrackEnd() { get().next() },

      setQueue(tracks: Track[], startIndex = 0) {
        const currentTrack = tracks[startIndex] ?? null
        set({ queue: tracks, currentQueueIndex: currentTrack ? startIndex : -1, currentTrack })
      },

      getCurrentQueueIndex() { return get().currentQueueIndex },

      addToQueue(track: Track, mode = 'last') {
        const state = get()
        if (!state.currentTrack) { set({ currentTrack: track, currentQueueIndex: 0, queue: [track] }); return }
        switch (mode) {
          case 'first': set({ queue: [track, ...state.queue], currentQueueIndex: state.currentQueueIndex + 1 }); break
          case 'after': set({ queue: [...state.queue.slice(0, state.currentQueueIndex + 1), track, ...state.queue.slice(state.currentQueueIndex + 1)] }); break
          default: set({ queue: [...state.queue, track] })
        }
      },

      removeFromQueue(trackId) {
        const state = get()
        const index = state.queue.findIndex((s) => s.id === trackId)
        if (index === -1) return
        set({ queue: state.queue.filter((s) => s.id !== trackId), currentQueueIndex: index < state.currentQueueIndex ? state.currentQueueIndex - 1 : state.currentQueueIndex })
      },

      clearQueue() { set({ queue: [] }) },

      moveInQueue(fromIndex, toIndex) {
        const newQueue = [...get().queue]
        const [movedItem] = newQueue.splice(fromIndex, 1)
        if (!movedItem) return
        newQueue.splice(toIndex, 0, movedItem)
        set({ queue: newQueue })
      },

      addTracksToEndOfQueue(tracksToAdd: Track[]) {
        if (!tracksToAdd || tracksToAdd.length === 0) return
        const state = get()
        const currentQueueIds = new Set(state.queue.map((s) => s.id))
        const newTracks = tracksToAdd.filter((track) => !currentQueueIds.has(track.id))
        if (newTracks.length > 0) set({ queue: [...state.queue, ...newTracks] })
      },

      setVolume({ volume }: { volume: number }) { set({ volume, isMuted: volume === 0 }) },
      toggleMute() { set({ isMuted: !get().isMuted }) },

      setPlaybackRate(rate: number) {
        const { duration } = get()
        if (duration && $htmlAudio.isLive(duration)) return
        set({ playbackRate: Math.max(0.25, Math.min(2, rate)) })
      },

      changeRepeatMode() {
        const modes: RepeatMode[] = ['none', 'one', 'all']
        set({ repeatMode: modes[(modes.indexOf(get().repeatMode) + 1) % modes.length] })
      },

      setRepeatMode(mode) { set({ repeatMode: mode }) },
      setInsertMode(mode) { set({ insertMode: mode }) },

      shuffle() {
        const state = get()
        if (!state.queue.length || state.queue.length < 2 || !state.currentTrack) return
        const remaining = state.queue.filter((_, i) => i !== state.currentQueueIndex).sort(() => Math.random() - 0.5)
        set({ queue: [state.currentTrack, ...remaining], currentQueueIndex: 0, shuffleEnabled: true })
      },

      unshuffle() { set({ shuffleEnabled: false }) },

      setCurrentTrack(track: Track | null) {
        const state = get()
        if (!track) { set({ currentTrack: null, currentQueueIndex: -1, isPlaying: false, currentTime: 0, duration: 0, queue: [], isLoading: false, isError: false, errorMessage: null }); return }
        if (state.currentTrack?.id === track.id) return
        set({ currentTrack: track, queue: [track], currentQueueIndex: 0, isLoading: true, isPlaying: false, currentTime: 0, duration: 0, isError: false, errorMessage: null })
        loadAndPlayTrack({ track, queueIndex: 0, set, get })
      },

      syncTime(currentTime: number, duration: number) {
        set({ currentTime, duration, progress: duration > 0 ? (currentTime / duration) * 100 : 0 })
      },

      setError(message) { set({ isError: !!message, errorMessage: message, isLoading: false, isPlaying: false }) },
    })),
    {
      name: 'audio:ui:store',
      partialize: (state) => ({
        currentTrack: state.currentTrack,
        queue: state.queue,
        volume: state.volume,
        isMuted: state.isMuted,
        playbackRate: state.playbackRate,
        repeatMode: state.repeatMode,
        shuffleEnabled: state.shuffleEnabled,
        currentTime: state.currentTime,
        insertMode: state.insertMode,
        currentQueueIndex: state.currentQueueIndex,
      }),
    }
  )
)

export { calculateNextIndex, calculatePreviousIndex, canUseDOM, useAudioStore }
export type { AudioStore, RepeatMode, InsertMode }

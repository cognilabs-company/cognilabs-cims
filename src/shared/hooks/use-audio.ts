import { $htmlAudio } from '@/shared/lib/audio/html-audio'

export function useAudio() {
  return { htmlAudio: $htmlAudio }
}

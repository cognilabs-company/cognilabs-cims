import { useCallback, useReducer } from 'react'
import type { MindMap } from './types'

type State = { past: MindMap[]; present: MindMap; future: MindMap[]; lastKey: string | null; lastAt: number }

type Action =
  | { type: 'apply'; fn: (map: MindMap) => MindMap; key?: string; at: number }
  | { type: 'undo' }
  | { type: 'redo' }

const LIMIT = 100
/** Edits with the same key within this time are one undo step (typing in a field). */
const COALESCE_MS = 1500

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'apply': {
      const next = action.fn(state.present)
      if (next === state.present) return state
      const coalesce = Boolean(action.key) && action.key === state.lastKey && action.at - state.lastAt < COALESCE_MS
      return {
        past: coalesce ? state.past : [...state.past.slice(-(LIMIT - 1)), state.present],
        present: next,
        future: [],
        lastKey: action.key ?? null,
        lastAt: action.at,
      }
    }
    case 'undo': {
      const previous = state.past.at(-1)
      if (!previous) return state
      return { past: state.past.slice(0, -1), present: previous, future: [state.present, ...state.future], lastKey: null, lastAt: 0 }
    }
    case 'redo': {
      const [next, ...rest] = state.future
      if (!next) return state
      return { past: [...state.past, state.present], present: next, future: rest, lastKey: null, lastAt: 0 }
    }
  }
}

/** Undo/redo over whole-map snapshots (maps are small; nodes are shared between snapshots). */
export function useMapHistory(initial: MindMap) {
  const [state, dispatch] = useReducer(reducer, { past: [], present: initial, future: [], lastKey: null, lastAt: 0 })
  const apply = useCallback((fn: (map: MindMap) => MindMap, key?: string) => dispatch({ type: 'apply', fn, key, at: Date.now() }), [])
  const undo = useCallback(() => dispatch({ type: 'undo' }), [])
  const redo = useCallback(() => dispatch({ type: 'redo' }), [])
  return { map: state.present, apply, undo, redo, canUndo: state.past.length > 0, canRedo: state.future.length > 0 }
}

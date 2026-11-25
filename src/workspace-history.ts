type History = { back: string[]; current: string; forward: string[] }
type Action = { visit: string } | 'back' | 'forward'
export function workspaceHistory(view: string): History {
  return { back: [], current: view, forward: [] }
}
export function navigateHistory(state: History, action: Action): History {
  if (action === 'back')
    return state.back.length
      ? {
          back: state.back.slice(0, -1),
          current: state.back.at(-1)!,
          forward: [state.current, ...state.forward],
        }
      : state
  if (action === 'forward')
    return state.forward.length
      ? { back: [...state.back, state.current], current: state.forward[0], forward: state.forward.slice(1) }
      : state
  if (action.visit === state.current) return state
  return { back: [...state.back, state.current].slice(-50), current: action.visit, forward: [] }
}

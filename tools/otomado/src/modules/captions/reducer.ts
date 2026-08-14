export interface CaptionsState {
  finals: string[]
  interim: string
}

export type CaptionsAction =
  | { type: 'final'; text: string }
  | { type: 'interim'; text: string }
  | { type: 'clear' }

export const initialCaptionsState: CaptionsState = { finals: [], interim: '' }

/** 表示行数の上限（メモリ・描画保護） */
export const MAX_FINALS = 200

export function captionsReducer(state: CaptionsState, action: CaptionsAction): CaptionsState {
  switch (action.type) {
    case 'final': {
      const text = action.text.trim()
      if (!text) return { ...state, interim: '' }
      const finals = [...state.finals, text]
      if (finals.length > MAX_FINALS) finals.splice(0, finals.length - MAX_FINALS)
      return { finals, interim: '' }
    }
    case 'interim':
      return { ...state, interim: action.text }
    case 'clear':
      return { finals: [], interim: '' }
  }
}

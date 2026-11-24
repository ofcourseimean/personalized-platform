export interface TakeoverWindow { windowId: string; title: string; processId: number }
export interface TakeoverControl { id: string; name: string; automationId: string; controlType: number; canFill: boolean; canInvoke: boolean; selected?: boolean; expanded?: boolean; canScroll?: boolean }
export interface TakeoverObservation { revision: number; windowTitle: string; controls: TakeoverControl[]; truncated: boolean }
export const takeoverOperations = ['fill', 'invoke', 'select', 'expand', 'collapse', 'scroll_down', 'scroll_up'] as const
export interface TakeoverAction { elementId: string; operation: typeof takeoverOperations[number]; text?: string }
export function supportsTakeoverAction(control: TakeoverControl, operation: TakeoverAction['operation']) {
  switch (operation) {
    case 'fill': return control.canFill && control.controlType === 50004
    case 'invoke': return control.canInvoke
    case 'select': return control.selected !== undefined
    case 'expand': return control.expanded === false
    case 'collapse': return control.expanded === true
    case 'scroll_down':
    case 'scroll_up': return control.canScroll === true
  }
}
export type TakeoverPhase = 'idle' | 'observing' | 'thinking' | 'acting' | 'checking' | 'paused' | 'waiting' | 'finished' | 'stopped' | 'error'
export interface TakeoverProgress { phase: TakeoverPhase; actions: number; message: string; pending?: TakeoverAction; target?: string }
export const takeoverRequestEvent = 'yiyu:prepare-computer-takeover'

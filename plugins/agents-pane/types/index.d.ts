export type AgentStatus = 'running' | 'done' | 'stopped' | 'failed'

export type AgentRow = {
  id: string
  description: string
  type: string
  model: string
  isBackground: boolean
  status: AgentStatus
  startedAt: number
  endedAt: number | null
  tools: number
  lastTool: string | null
  tokens: number
  /** Roster spot on Team Claude: picks the jersey number and gear. Absent on rows from before the team. */
  player?: number
}

declare module 'claude-code' {
  interface PluginState {
    'agents-pane': { agents: AgentRow[]; isStripHidden: boolean; signed: number; isPaneUp: boolean; tick: number }
  }
}

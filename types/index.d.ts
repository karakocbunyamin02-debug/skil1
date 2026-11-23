export type Turn = { durationMs: number }
export type ToolCounts = Record<string, number>

declare module 'claude-code' {
  interface PluginState {
    'status-line': {
      turns: Turn[]
      toolCounts: ToolCounts
    }
  }
}

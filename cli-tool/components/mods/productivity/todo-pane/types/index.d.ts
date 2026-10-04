// todo.md split on "\n", or null while the file does not exist.
export type TodoLines = string[] | null

declare module 'claude-code' {
  interface PluginState {
    'todo-pane': { lines: TodoLines }
  }
}

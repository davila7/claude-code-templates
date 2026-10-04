// todo.md split on "\n", or null while the file does not exist.
export type TodoLines = string[] | null

declare module 'claude-code' {
  interface PluginState {
    // false while todo.md is left alone: a symbolic link, or a file that cannot be read.
    'todo-pane': { lines: TodoLines | false }
  }
}

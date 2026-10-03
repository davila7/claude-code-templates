// Claude Code's hooks sandbox has the TC39 base64 methods on Uint8Array; TypeScript 5.x's
// libraries don't declare them yet.
interface Uint8Array {
  toBase64(): string
}
interface Uint8ArrayConstructor {
  fromBase64(base64: string): Uint8Array<ArrayBuffer>
}

// The test runner's environment has timers too.
declare function setTimeout(fn: (...args: any[]) => void, ms?: number): unknown

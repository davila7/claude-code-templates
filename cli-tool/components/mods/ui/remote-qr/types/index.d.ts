/** The remote session link whose QR Code shows above the prompt, or null when hidden. */
export type ShownUrl = string | null

declare module 'claude-code' {
  interface PluginState {
    'remote-qr': { url: ShownUrl }
  }
}

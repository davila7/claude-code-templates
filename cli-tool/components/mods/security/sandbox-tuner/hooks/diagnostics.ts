// The diagnostic form: the mod, the event, and the cause.

const MOD = 'sandbox-tuner'

export function diagnostic(event: string, detail: string | null, cause: string): string {
  return `${MOD}: ${event}${detail === null ? '' : ` (${detail})`}: ${cause}`
}

export function causeOf(error: unknown): string {
  return error instanceof Error && error.message !== '' ? error.message : String(error)
}

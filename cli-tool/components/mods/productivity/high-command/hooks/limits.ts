/** Every bound of High Command, in one place. */
export const LIMITS = {
  /** Entries kept in all; the oldest drop first. */
  entries: 200,
  /** Entries kept for one peer; a busy peer drops its own oldest entries first. */
  peerEntries: 50,
  /** Peers kept; the ones reported least recently drop first. */
  peers: 100,
  /** Characters of a body kept; the transcript keeps the rest. */
  bodyChars: 2000,
  /** Characters of a summary line. */
  summaryChars: 120,
  /** Characters of a displayed peer label; identity keys keep the full normalized name. */
  nameChars: 60,
  /** Characters of a ListAgents state word. */
  stateChars: 24,
  /** Peer rows on one roster page. */
  rosterRows: 50,
  /** Entries drawn in one thread. */
  threadEntries: 20,
  /**
   * The engine's bounds on one drawing: characters of text, nodes (strings count), and depth. The engine
   * refuses a drawing past any of them, so the band checks the drawing it wraps against them.
   */
  drawingText: 100_000,
  drawingNodes: 20_000,
  drawingDepth: 32,
  /** Peers named in the band. */
  bandPeers: 3,
  /** Roster rows that get a digit hotkey. */
  hotkeys: 9,
} as const

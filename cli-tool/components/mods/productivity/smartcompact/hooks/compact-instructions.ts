/** What the summarizer is told after a judge yes. */
export const JUDGE_INSTRUCTIONS = 'Keep the current goal, the next step and open decisions.';

/** What the summarizer is told after a tag, including pending subagent reports when any still run. */
export function instructionsForRequest(next: string, agents: string[] = []): string {
  const running = agents.length === 0 ? '' : ` Keep the ids of the subagents still running (${agents.join(', ')}) and what to do with each report when it arrives.`;

  return `Keep the current goal, open decisions and what this next step needs: ${next}${running}`;
}

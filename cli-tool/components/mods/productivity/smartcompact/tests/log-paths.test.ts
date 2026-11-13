import { expect, test } from 'claude-code/testing';
import type { Engine } from '../hooks/engine.ts';
import { choicesFilePath, logFilePath, smartcompactFolder } from '../hooks/log-paths.ts';

function engineWith(env: { logFile?: string; userProfile?: string; home?: string }): Engine {
  return {
    env: {
      logFile: async () => env.logFile,
      userProfile: async () => env.userProfile,
      home: async () => env.home,
    },
  } as unknown as Engine;
}

test('a Windows log override puts choices.md beside it', async () => {
  const engine = engineWith({ logFile: 'C:\\Users\\me\\logs\\log.jsonl' });

  expect(await logFilePath(engine)).toBe('C:\\Users\\me\\logs\\log.jsonl');
  expect(await choicesFilePath(engine)).toBe('C:\\Users\\me\\logs/choices.md');
});

test('a Windows USERPROFILE holds the smartcompact folder', async () => {
  expect(await smartcompactFolder(engineWith({ userProfile: 'C:\\Users\\me' }))).toBe('C:\\Users\\me/.claude/smartcompact');
});

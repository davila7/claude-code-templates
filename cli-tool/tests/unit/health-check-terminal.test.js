/**
 * --health-check must finish without a terminal (CI, pipes, an agent's shell):
 * before 1.31.0 it waited forever on "Would you like to run the Project Setup?".
 */
jest.mock('inquirer', () => ({ prompt: jest.fn() }));

const inquirer = require('inquirer');
const { HealthChecker, isInteractiveTerminal, runHealthCheck } = require('../../src/health-check');

describe('health check without a terminal', () => {
  const saved = {
    stdin: process.stdin.isTTY,
    stdout: process.stdout.isTTY,
    ci: process.env.CI
  };

  afterEach(() => {
    process.stdin.isTTY = saved.stdin;
    process.stdout.isTTY = saved.stdout;
    if (saved.ci === undefined) delete process.env.CI; else process.env.CI = saved.ci;
    jest.restoreAllMocks();
    inquirer.prompt.mockReset();
  });

  function setTerminal(isTTY, ci) {
    process.stdin.isTTY = isTTY;
    process.stdout.isTTY = isTTY;
    if (ci === undefined) delete process.env.CI; else process.env.CI = ci;
  }

  it('detects a terminal only when both ends are TTYs and CI is unset', () => {
    setTerminal(true, undefined);
    expect(isInteractiveTerminal()).toBe(true);
    setTerminal(undefined, undefined);
    expect(isInteractiveTerminal()).toBe(false);
    setTerminal(true, 'true');
    expect(isInteractiveTerminal()).toBe(false);
  });

  it('returns the report without prompting', async () => {
    setTerminal(undefined, undefined);
    jest.spyOn(HealthChecker.prototype, 'runHealthCheck').mockResolvedValue({ percentage: 40 });
    const result = await runHealthCheck();
    expect(result).toEqual({ results: { percentage: 40 }, runSetup: false });
    expect(inquirer.prompt).not.toHaveBeenCalled();
  });

  it('still offers the project setup in a terminal', async () => {
    setTerminal(true, undefined);
    jest.spyOn(HealthChecker.prototype, 'runHealthCheck').mockResolvedValue({ percentage: 40 });
    inquirer.prompt.mockResolvedValue({ runSetup: true });
    const result = await runHealthCheck();
    expect(result.runSetup).toBe(true);
    expect(inquirer.prompt).toHaveBeenCalledTimes(1);
  });

  it('skips the pauses between sections without a terminal', async () => {
    const checker = new HealthChecker({ interactive: false });
    const started = Date.now();
    await checker.sleep(3000);
    expect(Date.now() - started).toBeLessThan(100);
  });

  it('no longer counts a placeholder "not implemented" check', () => {
    expect(HealthChecker.prototype.checkMCPHooks).toBeUndefined();
  });
});

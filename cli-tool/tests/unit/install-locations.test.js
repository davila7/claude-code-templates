/**
 * Install Locations Utilities Test Suite
 */

const path = require('path');
const os = require('os');

const {
  getInstallLocationChoices,
  resolveInstallLocation,
  getSettingsFilePath,
  mergeConfigurations,
  detectConfigConflicts
} = require('../../src/utils/install-locations');

describe('Install Locations Utils', () => {
  const mockProjectDir = '/test/project';

  describe('getInstallLocationChoices', () => {
    it('should return an array of choices', () => {
      const choices = getInstallLocationChoices();
      expect(Array.isArray(choices)).toBe(true);
      expect(choices.length).toBeGreaterThan(0);
    });

    it('should include user, project, local, and enterprise options', () => {
      const choices = getInstallLocationChoices();
      const values = choices.map(c => c.value);
      expect(values).toContain('user');
      expect(values).toContain('project');
      expect(values).toContain('local');
      expect(values).toContain('enterprise');
    });

    it('should have local as the default checked option', () => {
      const choices = getInstallLocationChoices();
      const localChoice = choices.find(c => c.value === 'local');
      expect(localChoice.checked).toBe(true);
    });
  });

  describe('resolveInstallLocation', () => {
    it('should resolve user location to home directory', () => {
      const result = resolveInstallLocation('user', mockProjectDir);
      expect(result.targetDir).toBe(os.homedir());
      expect(result.settingsFile).toBe('settings.json');
      expect(result.isEnterprise).toBe(false);
    });

    it('should resolve project location to project directory', () => {
      const result = resolveInstallLocation('project', mockProjectDir);
      expect(result.targetDir).toBe(mockProjectDir);
      expect(result.settingsFile).toBe('settings.json');
      expect(result.isEnterprise).toBe(false);
    });

    it('should resolve local location to project directory with local settings', () => {
      const result = resolveInstallLocation('local', mockProjectDir);
      expect(result.targetDir).toBe(mockProjectDir);
      expect(result.settingsFile).toBe('settings.local.json');
      expect(result.isEnterprise).toBe(false);
    });

    it('should resolve enterprise location based on platform', () => {
      const result = resolveInstallLocation('enterprise', mockProjectDir);
      expect(result.settingsFile).toBe('managed-settings.json');
      // Enterprise path varies by platform, just verify it's set
      expect(result.targetDir).toBeDefined();
    });
  });

  describe('getSettingsFilePath', () => {
    it('should return correct paths for user location', () => {
      const result = getSettingsFilePath('user', mockProjectDir);
      expect(result.claudeDir).toBe(path.join(os.homedir(), '.claude'));
      expect(result.actualTargetFile).toBe(path.join(os.homedir(), '.claude', 'settings.json'));
      expect(result.isEnterprise).toBe(false);
    });

    it('should return correct paths for local location', () => {
      const result = getSettingsFilePath('local', mockProjectDir);
      expect(result.claudeDir).toBe(path.join(mockProjectDir, '.claude'));
      expect(result.actualTargetFile).toBe(path.join(mockProjectDir, '.claude', 'settings.local.json'));
    });
  });

  describe('mergeConfigurations', () => {
    it('should merge simple configurations', () => {
      const existing = { a: 1, b: 2 };
      const newConfig = { b: 3, c: 4 };
      const result = mergeConfigurations(existing, newConfig);
      expect(result).toEqual({ a: 1, b: 3, c: 4 });
    });

    it('should deep merge permissions', () => {
      const existing = {
        permissions: {
          allow: ['cmd1'],
          deny: ['deny1']
        }
      };
      const newConfig = {
        permissions: {
          allow: ['cmd2'],
          ask: ['ask1']
        }
      };
      const result = mergeConfigurations(existing, newConfig);
      expect(result.permissions.allow).toContain('cmd1');
      expect(result.permissions.allow).toContain('cmd2');
      expect(result.permissions.deny).toContain('deny1');
      expect(result.permissions.ask).toContain('ask1');
    });

    it('should deduplicate merged arrays', () => {
      const existing = {
        permissions: {
          allow: ['cmd1', 'cmd2']
        }
      };
      const newConfig = {
        permissions: {
          allow: ['cmd2', 'cmd3']
        }
      };
      const result = mergeConfigurations(existing, newConfig);
      const allowCounts = result.permissions.allow.filter(x => x === 'cmd2').length;
      expect(allowCounts).toBe(1);
    });

    it('should deep merge env variables', () => {
      const existing = { env: { VAR1: 'value1' } };
      const newConfig = { env: { VAR2: 'value2' } };
      const result = mergeConfigurations(existing, newConfig);
      expect(result.env).toEqual({ VAR1: 'value1', VAR2: 'value2' });
    });

    it('should deep merge hooks', () => {
      const existing = { hooks: { preCommit: 'hook1' } };
      const newConfig = { hooks: { postCommit: 'hook2' } };
      const result = mergeConfigurations(existing, newConfig);
      expect(result.hooks).toEqual({ preCommit: 'hook1', postCommit: 'hook2' });
    });
  });

  describe('detectConfigConflicts', () => {
    it('should detect no conflicts for non-overlapping configs', () => {
      const existing = { a: 1 };
      const newConfig = { b: 2 };
      const conflicts = detectConfigConflicts(existing, newConfig);
      expect(conflicts).toEqual([]);
    });

    it('should detect conflicts for differing values', () => {
      const existing = { setting: 'old' };
      const newConfig = { setting: 'new' };
      const conflicts = detectConfigConflicts(existing, newConfig);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0]).toContain('setting');
    });

    it('should detect env variable conflicts', () => {
      const existing = { env: { VAR: 'old' } };
      const newConfig = { env: { VAR: 'new' } };
      const conflicts = detectConfigConflicts(existing, newConfig);
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0]).toContain('VAR');
    });

    it('should not report conflicts for identical values', () => {
      const existing = { setting: 'same' };
      const newConfig = { setting: 'same' };
      const conflicts = detectConfigConflicts(existing, newConfig);
      expect(conflicts).toEqual([]);
    });

    it('should ignore description and files fields', () => {
      const existing = { description: 'old desc' };
      const newConfig = { description: 'new desc', files: {} };
      const conflicts = detectConfigConflicts(existing, newConfig);
      expect(conflicts).toEqual([]);
    });
  });
});

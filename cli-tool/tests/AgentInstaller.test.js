/**
 * Unit tests for AgentInstaller module
 */
const path = require('path');

// Mock fs-extra before requiring the module
jest.mock('fs-extra', () => ({
  ensureDir: jest.fn(),
  pathExists: jest.fn(),
  copy: jest.fn(),
  readdir: jest.fn()
}));

const fs = require('fs-extra');
const {
  ensureAgentsDirectory,
  installSingleAgent,
  logInstallResults,
  installAgents,
  getInstalledAgents
} = require('../src/agents/AgentInstaller');

describe('AgentInstaller', () => {
  const mockProjectPath = '/test/project';
  const mockAgentsDir = path.join(mockProjectPath, '.claude', 'agents');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ensureAgentsDirectory', () => {
    it('should create .claude/agents directory', async () => {
      fs.ensureDir.mockResolvedValue();

      const result = await ensureAgentsDirectory(mockProjectPath);

      expect(fs.ensureDir).toHaveBeenCalledWith(mockAgentsDir);
      expect(result).toBe(mockAgentsDir);
    });

    it('should propagate errors from fs.ensureDir', async () => {
      const error = new Error('Permission denied');
      fs.ensureDir.mockRejectedValue(error);

      await expect(ensureAgentsDirectory(mockProjectPath)).rejects.toThrow('Permission denied');
    });
  });

  describe('installSingleAgent', () => {
    const mockAgent = {
      name: 'test-agent',
      filePath: '/templates/test-agent.md',
      language: 'javascript',
      framework: 'react'
    };

    it('should return failure when agent is null', async () => {
      const result = await installSingleAgent(null, mockAgentsDir);

      expect(result).toEqual({ success: false, name: undefined, reason: 'not_found' });
    });

    it('should return failure when agent has no filePath', async () => {
      const result = await installSingleAgent({ name: 'no-path' }, mockAgentsDir);

      expect(result).toEqual({ success: false, name: 'no-path', reason: 'not_found' });
    });

    it('should return failure when source file does not exist', async () => {
      fs.pathExists.mockResolvedValue(false);

      const result = await installSingleAgent(mockAgent, mockAgentsDir);

      expect(result).toEqual({ success: false, name: 'test-agent', reason: 'source_missing' });
    });

    it('should copy agent file and return success', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.copy.mockResolvedValue();

      const result = await installSingleAgent(mockAgent, mockAgentsDir);

      expect(fs.copy).toHaveBeenCalledWith(
        mockAgent.filePath,
        path.join(mockAgentsDir, 'test-agent.md')
      );
      expect(result).toEqual({ success: true, name: 'test-agent', agent: mockAgent });
    });
  });

  describe('logInstallResults', () => {
    it('should return true when at least one agent installed', () => {
      const results = [
        { success: true, name: 'agent1', agent: { language: 'js', framework: 'react' } },
        { success: false, name: 'agent2', reason: 'not_found' }
      ];

      const result = logInstallResults(results);

      expect(result).toBe(true);
    });

    it('should return false when no agents installed', () => {
      const results = [
        { success: false, name: 'agent1', reason: 'not_found' },
        { success: false, name: 'agent2', reason: 'source_missing' }
      ];

      const result = logInstallResults(results);

      expect(result).toBe(false);
    });

    it('should return false for empty results', () => {
      const result = logInstallResults([]);

      expect(result).toBe(false);
    });
  });

  describe('installAgents', () => {
    const mockGetAvailableAgents = jest.fn();
    const mockAgents = [
      { name: 'agent1', filePath: '/path/agent1.md', language: 'js', framework: 'react' },
      { name: 'agent2', filePath: '/path/agent2.md', language: 'python', framework: 'django' }
    ];

    beforeEach(() => {
      mockGetAvailableAgents.mockReturnValue(mockAgents);
      fs.ensureDir.mockResolvedValue();
      fs.pathExists.mockResolvedValue(true);
      fs.copy.mockResolvedValue();
    });

    it('should install selected agents', async () => {
      const result = await installAgents(['agent1'], mockProjectPath, mockGetAvailableAgents);

      expect(fs.ensureDir).toHaveBeenCalledWith(mockAgentsDir);
      expect(mockGetAvailableAgents).toHaveBeenCalled();
      expect(fs.copy).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });

    it('should install multiple agents in parallel', async () => {
      const result = await installAgents(['agent1', 'agent2'], mockProjectPath, mockGetAvailableAgents);

      expect(fs.copy).toHaveBeenCalledTimes(2);
      expect(result).toBe(true);
    });

    it('should handle agent not found in available agents', async () => {
      const result = await installAgents(['nonexistent'], mockProjectPath, mockGetAvailableAgents);

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      fs.ensureDir.mockRejectedValue(new Error('Failed'));

      const result = await installAgents(['agent1'], mockProjectPath, mockGetAvailableAgents);

      expect(result).toBe(false);
    });

    it('should use process.cwd() as default project path', async () => {
      const originalCwd = process.cwd;
      process.cwd = jest.fn().mockReturnValue('/default/path');

      await installAgents(['agent1'], undefined, mockGetAvailableAgents);

      expect(fs.ensureDir).toHaveBeenCalledWith(
        path.join('/default/path', '.claude', 'agents')
      );

      process.cwd = originalCwd;
    });
  });

  describe('getInstalledAgents', () => {
    it('should return empty array when agents directory does not exist', async () => {
      fs.pathExists.mockResolvedValue(false);

      const result = await getInstalledAgents(mockProjectPath);

      expect(result).toEqual([]);
    });

    it('should return list of installed agent names', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readdir.mockResolvedValue(['agent1.md', 'agent2.md', 'readme.txt']);

      const result = await getInstalledAgents(mockProjectPath);

      expect(result).toEqual(['agent1', 'agent2']);
    });

    it('should filter out non-.md files', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readdir.mockResolvedValue(['agent.md', 'config.json', 'notes.txt']);

      const result = await getInstalledAgents(mockProjectPath);

      expect(result).toEqual(['agent']);
    });

    it('should return empty array on error', async () => {
      fs.pathExists.mockResolvedValue(true);
      fs.readdir.mockRejectedValue(new Error('Read error'));

      const result = await getInstalledAgents(mockProjectPath);

      expect(result).toEqual([]);
    });

    it('should use process.cwd() as default project path', async () => {
      const originalCwd = process.cwd;
      process.cwd = jest.fn().mockReturnValue('/default/path');
      fs.pathExists.mockResolvedValue(false);

      await getInstalledAgents();

      expect(fs.pathExists).toHaveBeenCalledWith(
        path.join('/default/path', '.claude', 'agents')
      );

      process.cwd = originalCwd;
    });
  });
});

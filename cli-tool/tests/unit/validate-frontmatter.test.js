const fs = require('fs');
const os = require('os');
const path = require('path');
const yaml = require('js-yaml');

const {
  validate,
  repair,
  needsQuoting,
  normaliseModel,
  isValidModel,
  isDocumentationFile,
} = require('../../src/validate-frontmatter');

let tmpDir;

beforeAll(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'frontmatter-'));
  fs.mkdirSync(path.join(tmpDir, 'agents'));
  fs.mkdirSync(path.join(tmpDir, 'commands'));
});

afterAll(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

/** Write a component file and validate it. */
function check(type, name, content) {
  const file = path.join(tmpDir, type, `${name}.md`);
  fs.writeFileSync(file, content, 'utf8');
  return validate(file);
}

const codes = (result) => result.issues.map((i) => i.code);

describe('needsQuoting', () => {
  it('flags values YAML would read as a flow sequence', () => {
    expect(needsQuoting('[issue-number]')).toBe(true);
    expect(needsQuoting('[file] [format]')).toBe(true);
  });

  it('flags values containing a key separator', () => {
    expect(needsQuoting('Beast Mode 2.0: a powerful agent')).toBe(true);
  });

  it('flags the YAML alias indicator', () => {
    expect(needsQuoting('*')).toBe(true);
  });

  it('leaves ordinary and already-quoted values alone', () => {
    expect(needsQuoting('a plain description')).toBe(false);
    expect(needsQuoting('"[issue-number]"')).toBe(false);
    expect(needsQuoting('Read, Grep, Glob')).toBe(false);
  });
});

describe('model values', () => {
  it('accepts documented aliases and full model IDs', () => {
    expect(isValidModel('sonnet')).toBe(true);
    expect(isValidModel('inherit')).toBe(true);
    expect(isValidModel('claude-opus-5')).toBe(true);
  });

  it('rejects human-readable labels', () => {
    expect(isValidModel('Claude Sonnet 4.5')).toBe(false);
    expect(isValidModel('Claude Sonnet 4.5 (copilot)')).toBe(false);
  });

  it('normalises a human-readable label onto its alias', () => {
    expect(normaliseModel('Claude Sonnet 4.5')).toBe('sonnet');
    expect(normaliseModel('Claude Opus 4.1')).toBe('opus');
  });

  it('leaves an already-valid value untouched', () => {
    expect(normaliseModel('sonnet')).toBeNull();
    expect(normaliseModel('claude-opus-5')).toBeNull();
  });
});

describe('validate', () => {
  it('passes a well-formed agent', () => {
    const result = check(
      'agents',
      'good-agent',
      '---\nname: good-agent\ndescription: Does a thing well\nmodel: sonnet\n---\n\n# Good\n'
    );
    expect(result.issues).toEqual([]);
  });

  it('reports a missing frontmatter block', () => {
    const result = check('agents', 'no-frontmatter', '# Just a heading\n');
    expect(codes(result)).toContain('FM_MISSING');
  });

  it('reports frontmatter that does not parse', () => {
    const result = check(
      'commands',
      'broken-yaml',
      '---\nargument-hint: [component-name] [--typescript]\n---\n\nBody\n'
    );
    expect(codes(result)).toContain('FM_INVALID_YAML');
  });

  it('reports argument-hint parsed as a list rather than a string', () => {
    const result = check('commands', 'list-hint', '---\nargument-hint: [file]\n---\n\nBody\n');
    expect(codes(result)).toContain('FM_WRONG_TYPE');
  });

  it('reports an unusable model value', () => {
    const result = check(
      'agents',
      'bad-model',
      '---\nname: bad-model\ndescription: x\nmodel: Claude Sonnet 4.5\n---\n\nBody\n'
    );
    expect(codes(result)).toContain('FM_BAD_MODEL');
  });

  it('requires name and description on an agent', () => {
    const result = check('agents', 'nameless', '---\ndescription: x\n---\n\nBody\n');
    expect(codes(result)).toContain('FM_MISSING_FIELD');
  });

  it('does not require name on a command — it comes from the file name', () => {
    const result = check('commands', 'nameless-command', '---\ndescription: x\n---\n\nBody\n');
    expect(result.issues).toEqual([]);
  });
});

describe('repair', () => {
  const parse = (block) => yaml.load(repair(block).block);

  it('quotes a bracketed argument-hint', () => {
    const { block, changed } = repair('argument-hint: [component-name] [--typescript]');
    expect(changed).toBe(true);
    expect(yaml.load(block)['argument-hint']).toBe('[component-name] [--typescript]');
  });

  it('quotes a description containing a colon', () => {
    const parsed = parse('description: Beast Mode 2.0: a powerful autonomous agent');
    expect(parsed.description).toBe('Beast Mode 2.0: a powerful autonomous agent');
  });

  it('quotes a bare asterisk tools value', () => {
    expect(parse('tools: *').tools).toBe('*');
  });

  it('normalises a human-readable model label', () => {
    expect(parse('name: a\nmodel: Claude Sonnet 4.5 (copilot)').model).toBe('sonnet');
  });

  it('leaves an existing block scalar intact', () => {
    const block = 'description: |\n  Line one\n  Line two: with a colon\nmodel: sonnet';
    const { changed } = repair(block);
    expect(changed).toBe(false);
    expect(yaml.load(block).description).toContain('Line two: with a colon');
  });

  it('promotes a multi-line plain scalar to a block scalar', () => {
    const block = [
      'name: api-architect',
      'description: Expert architect. Use when you need to: design a schema.',
      '',
      '  <example>',
      '  user: design something',
      '  </example>',
      'model: sonnet',
    ].join('\n');

    const { block: repaired, changed } = repair(block);
    expect(changed).toBe(true);

    const parsed = yaml.load(repaired);
    expect(parsed.name).toBe('api-architect');
    expect(parsed.model).toBe('sonnet');
    expect(parsed.description).toContain('user: design something');
  });

  it('never emits frontmatter that fails to parse', () => {
    const samples = [
      'argument-hint: [a] [b]',
      'description: A: B: C',
      'tools: *',
      'model: Claude Sonnet 4',
      'name: x\ndescription: |\n  block\n  scalar: here',
    ];
    for (const sample of samples) {
      expect(() => yaml.load(repair(sample).block)).not.toThrow();
    }
  });
});

describe('isDocumentationFile', () => {
  it('recognises the directory-level docs Claude Code never loads', () => {
    expect(isDocumentationFile('cli-tool/components/agents/programming-languages/README.md')).toBe(true);
    expect(isDocumentationFile('cli-tool/components/agents/deep-research-team/agent-overview.md')).toBe(true);
    expect(isDocumentationFile('cli-tool/components/commands/git/index.md')).toBe(true);
    expect(isDocumentationFile('cli-tool/components/commands/git/readme.md')).toBe(true);
  });

  it('leaves real components alone, even when the name contains a doc word', () => {
    expect(isDocumentationFile('cli-tool/components/agents/git/commit-guardian.md')).toBe(false);
    expect(isDocumentationFile('cli-tool/components/commands/docs/readme-generator.md')).toBe(false);
    expect(isDocumentationFile('cli-tool/components/commands/search/index-codebase.md')).toBe(false);
  });
});

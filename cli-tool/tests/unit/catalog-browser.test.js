// @clack/prompts ships ESM only, which this Jest setup does not transform.
jest.mock('@clack/prompts', () => ({ S_STEP_ACTIVE: '◆' }));

const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const {
  componentOptions, searchOptions, matchesQuery, detectProjectTags, equivalentCommand, printNonInteractiveHelp
} = require('../../src/catalog-browser');

const component = (name, category, downloads, extra = {}) => ({
  id: `agents/${category}/${name}`, name, category, downloads, description: `${name} agent`, keywords: [], ...extra
});

describe('catalog-browser', () => {
  const catalog = [
    component('react-specialist', 'programming-languages', 800),
    component('code-reviewer', 'development-tools', 31000),
    component('architect-review', 'expert-advisors', 5000, { description: 'Reviews code architecture' }),
    component('docs-writer', 'documentation', 9000)
  ];

  test('without a query, project matches come first, then installs', () => {
    const order = componentOptions(catalog, ['react']).map(o => o.value);
    expect(order).toEqual([
      'agents/programming-languages/react-specialist',
      'agents/development-tools/code-reviewer',
      'agents/documentation/docs-writer',
      'agents/expert-advisors/architect-review'
    ]);
  });

  test('while searching, a name match beats a project match', () => {
    const options = componentOptions(catalog, ['react']);
    const ranked = searchOptions(options, 'code review').filter(o => matchesQuery(o, 'code review'));
    expect(ranked.map(o => o.value)).toEqual([
      'agents/development-tools/code-reviewer',
      'agents/expert-advisors/architect-review'
    ]);
  });

  test('every query word must appear somewhere in the component', () => {
    const [option] = componentOptions([catalog[2]], []);
    expect(matchesQuery(option, 'architecture review')).toBe(true);
    expect(matchesQuery(option, 'review python')).toBe(false);
    expect(matchesQuery(option, '')).toBe(true);
  });

  test('detectProjectTags reads package.json dependencies and manifests', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cct-browser-'));
    fs.writeJsonSync(path.join(dir, 'package.json'), {
      dependencies: { react: '18', '@supabase/supabase-js': '2' }, devDependencies: { typescript: '5', tailwindcss: '4' }
    });
    fs.writeFileSync(path.join(dir, 'Dockerfile'), 'FROM node');
    expect(detectProjectTags(dir).sort()).toEqual(['docker', 'javascript', 'react', 'supabase', 'tailwind', 'typescript']);
    expect(detectProjectTags(path.join(dir, 'missing'))).toEqual([]);
    fs.removeSync(dir);
  });

  test('equivalentCommand lists the selection in a stable flag order', () => {
    expect(equivalentCommand({ skill: 'a/b', agent: 'c/d,e/f' }))
      .toBe('npx claude-code-templates@latest --agent c/d,e/f --skill a/b');
  });

  test('the non-interactive help says nothing was installed and how to install', () => {
    const lines = [];
    const spy = jest.spyOn(console, 'log').mockImplementation(text => lines.push(text));
    printNonInteractiveHelp('9.9.9');
    spy.mockRestore();
    const text = lines.join('\n');
    expect(text).toContain('nothing was installed');
    expect(text).toContain('--skill <category/name>');
    expect(text).toContain('/api/v1/catalog.json');
  });
});

import copy
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from datetime import datetime, timezone


MODULE_PATH = Path(__file__).with_name("catalog_api_v1.py")
SPEC = importlib.util.spec_from_file_location("catalog_api_v1", MODULE_PATH)
v1 = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(v1)

NOW = datetime(2026, 10, 21, 3, 0, 0, tzinfo=timezone.utc)


def entry(type_singular, path, **extra):
    name = path.split('/')[-1].rsplit('.', 1)[0] if path.endswith(('.md', '.json')) else path.split('/')[-1]
    base = {
        'name': name, 'path': path, 'category': path.split('/')[0], 'type': type_singular,
        'description': 'Does a thing', 'author': '', 'repo': '', 'version': '', 'license': '',
        'keywords': [], 'downloads': 7,
        'security': {'validated': False, 'valid': None, 'score': None},
        'skillspector': {'score': 12, 'severity': 'LOW', 'recommendation': 'SAFE', 'issueCount': 0,
                         'analysis': 'complete', 'findings': [], 'hash': 'abc', 'version': '2.12.0',
                         'scannedAt': '2026-10-17T20:36:45Z'},
    }
    base.update(extra)
    return base


def index():
    return {
        'agents': [entry('agent', 'development-team/frontend-developer.md', author='Ada')],
        'skills': [entry('skill', 'development/pdf', references=['scripts/run.py'])],
        'mcps': [entry('mcp', 'devtools/stripe.json')],
        'mods': [entry('mod', 'ui/stack-viewer', references=['hooks/hooks.json'],
                       modules=['stack.tsx'], userConfig={})],
        'sandbox': [entry('sandbo', 'e2b/README.md')],
        'templates': [{'name': 'common', 'id': 'common', 'type': 'template'}],
        'plugins': [],
        'componentsMarketplace': {'agents': []},
    }


class ToV1Test(unittest.TestCase):

    def test_single_file_component(self):
        c = v1.build_components(index())[0]
        self.assertEqual(c['id'], 'agents/development-team/frontend-developer')
        self.assertEqual(c['type'], 'agents')
        self.assertEqual(c['author'], 'Ada')
        # Empty strings become null, never ''
        self.assertIsNone(c['repo'])
        self.assertIsNone(c['license'])
        self.assertEqual(c['install']['args'], ['--agent', 'development-team/frontend-developer'])
        self.assertEqual(c['install']['command'],
                         'npx claude-code-templates@latest --agent development-team/frontend-developer')
        self.assertEqual(c['urls']['page'],
                         'https://www.aitmpl.com/component/agents/development-team/frontend-developer')
        self.assertTrue(c['urls']['source'].endswith('/blob/main/cli-tool/components/agents/development-team/frontend-developer.md'))
        self.assertIsNone(c['files'])
        self.assertEqual(c['scan'], {'tool': 'skillspector', 'toolVersion': '2.12.0', 'severity': 'LOW',
                                     'score': 12, 'scannedAt': '2026-10-17T20:36:45Z'})
        for dropped in ('security', 'skillspector', 'references', 'modules', 'userConfig'):
            self.assertNotIn(dropped, c)

    def test_directory_components_link_the_tree_and_list_files(self):
        by_id = {c['id']: c for c in v1.build_components(index())}
        skill = by_id['skills/development/pdf']
        self.assertIn('/tree/main/cli-tool/components/skills/development/pdf', skill['urls']['source'])
        self.assertEqual(skill['files'], ['scripts/run.py'])
        self.assertEqual(by_id['mcps/devtools/stripe']['install']['args'], ['--mcp', 'devtools/stripe'])
        self.assertEqual(by_id['mods/ui/stack-viewer']['install']['args'], ['--mod', 'ui/stack-viewer'])

    def test_external_skill_publishes_source_and_links_upstream(self):
        commit = '7de017b3fc9d50c03cf3ecb98fb71e0ca65a78bd'
        data = index()
        data['skills'].append(entry('skill', 'git/babysit-pr', license='MIT', source={
            'repo': 't3dotgg/tstack', 'path': 'skills/babysit-pr', 'commit': commit, 'license': 'MIT',
            'url': f'https://github.com/t3dotgg/tstack/tree/{commit}/skills/babysit-pr', 'requires': []}))
        by_id = {c['id']: c for c in v1.build_components(data)}
        ext = by_id['skills/git/babysit-pr']
        self.assertEqual(ext['source'], {'repo': 't3dotgg/tstack', 'path': 'skills/babysit-pr',
                                         'commit': commit, 'license': 'MIT'})
        self.assertEqual(ext['urls']['source'], f'https://github.com/t3dotgg/tstack/tree/{commit}/skills/babysit-pr')
        self.assertEqual(ext['install']['args'], ['--skill', 'git/babysit-pr'])
        self.assertIsNone(by_id['skills/development/pdf']['source'])
        v1.validate({'catalog.json': ('catalog', {'schemaVersion': v1.SCHEMA_VERSION, 'generatedAt': '2026-10-26T00:00:00Z',
                                                  'source': 'x', 'docs': 'https://www.aitmpl.com/developers/catalog-api',
                                                  'count': 1, 'components': [ext]})})

    def test_leftover_groups_are_not_published(self):
        types = {c['type'] for c in v1.build_components(index())}
        self.assertEqual(types, {'agents', 'skills', 'mcps', 'mods'})

    def test_sorted_by_id(self):
        ids = [c['id'] for c in v1.build_components(index())]
        self.assertEqual(ids, sorted(ids))

    def test_duplicate_ids_raise(self):
        data = index()
        data['agents'].append(copy.deepcopy(data['agents'][0]))
        with self.assertRaises(ValueError):
            v1.build_components(data)

    def test_missing_content_file_gives_null_url(self):
        c = v1.build_components(index(), content_exists=lambda t, slug: t != 'agents')
        by_id = {x['id']: x for x in c}
        self.assertIsNone(by_id['agents/development-team/frontend-developer']['urls']['content'])
        self.assertIsNotNone(by_id['skills/development/pdf']['urls']['content'])

    def test_unscanned_component_has_null_scan(self):
        data = index()
        del data['agents'][0]['skillspector']
        self.assertIsNone(v1.build_components(data)[0]['scan'])


class WriteTest(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.out = os.path.join(self.tmp.name, 'v1')

    def tearDown(self):
        self.tmp.cleanup()

    def read(self, rel):
        with open(os.path.join(self.out, rel), 'r', encoding='utf-8') as f:
            return f.read()

    def test_writes_every_file_and_leaves_the_index_alone(self):
        data = index()
        before = copy.deepcopy(data)
        version = v1.write_catalog_api_v1(data, out_dir=self.out, now=NOW)
        self.assertEqual(data, before)
        for rel in ['catalog.json', 'version.json', 'schema.json'] + [f'catalog/{t}.json' for t in v1.TYPES]:
            self.assertTrue(os.path.isfile(os.path.join(self.out, rel)), rel)
        catalog = json.loads(self.read('catalog.json'))
        self.assertEqual(catalog['generatedAt'], '2026-10-21T03:00:00Z')
        self.assertEqual(catalog['count'], 4)
        self.assertEqual(json.loads(self.read('catalog/agents.json'))['count'], 1)
        self.assertEqual(json.loads(self.read('catalog/loops.json'))['components'], [])
        import hashlib
        self.assertEqual(version['sha256'], hashlib.sha256(self.read('catalog.json').encode('utf-8')).hexdigest())
        self.assertEqual(version['counts']['mods'], 1)

    def test_unchanged_components_keep_generated_at_and_bytes(self):
        v1.write_catalog_api_v1(index(), out_dir=self.out, now=NOW)
        first = self.read('catalog.json'), self.read('version.json')
        v1.write_catalog_api_v1(index(), out_dir=self.out, now=datetime(2026, 10, 22, tzinfo=timezone.utc))
        self.assertEqual((self.read('catalog.json'), self.read('version.json')), first)

    def test_changed_components_move_generated_at(self):
        v1.write_catalog_api_v1(index(), out_dir=self.out, now=NOW)
        data = index()
        data['agents'][0]['downloads'] = 8
        version = v1.write_catalog_api_v1(data, out_dir=self.out, now=datetime(2026, 10, 22, tzinfo=timezone.utc))
        self.assertEqual(version['generatedAt'], '2026-10-22T00:00:00Z')

    def test_output_failing_the_schema_is_not_written(self):
        data = index()
        data['agents'][0]['skillspector']['severity'] = 'SEVERE'
        with self.assertRaises(ValueError):
            v1.write_catalog_api_v1(data, out_dir=self.out, now=NOW)
        self.assertFalse(os.path.exists(os.path.join(self.out, 'catalog.json')))


class SchemaTest(unittest.TestCase):

    def test_every_published_field_is_declared(self):
        declared = set(v1.load_schema()['$defs']['component']['properties'])
        produced = set(v1.build_components(index())[0])
        self.assertEqual(produced, declared)

    def test_undeclared_field_is_rejected(self):
        catalog = {'schemaVersion': '1.0.0', 'generatedAt': '2026-10-21T03:00:00Z', 'source': v1.REPO,
                   'docs': v1.DOCS, 'count': 1,
                   'components': [dict(v1.build_components(index())[0], sponsored=True)]}
        with self.assertRaises(ValueError):
            v1.validate({'catalog.json': ('catalog', catalog)})

    def test_committed_catalog_matches_the_schema(self):
        path = Path(__file__).resolve().parent.parent / 'dashboard/public/api/v1/catalog.json'
        if not path.is_file():
            self.skipTest('no generated catalog in this checkout')
        with open(path, 'r', encoding='utf-8') as f:
            v1.validate({'catalog.json': ('catalog', json.load(f))})


if __name__ == '__main__':
    unittest.main()

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from mcp_versions import EXACT, pinned_spec, server_package, split_spec  # noqa: E402


class ServerPackage(unittest.TestCase):
    def test_npx_first_positional(self):
        self.assertEqual(server_package('npx', ['-y', '@upstash/context7-mcp@1.0.0']), ('npm', '@upstash/context7-mcp@1.0.0'))

    def test_npx_package_flag(self):
        args = ['-y', '--package', '@launchdarkly/mcp-server', '--', 'mcp', 'start']
        self.assertEqual(server_package('npx', args), ('npm', '@launchdarkly/mcp-server'))

    def test_command_string(self):
        self.assertEqual(server_package('npx mcp-remote https://x.example/sse', None), ('npm', 'mcp-remote'))

    def test_uvx_skips_option_values_and_reads_from(self):
        self.assertEqual(server_package('uvx', ['--python', '3.13', 'android-mcp']), ('pypi-uvx', 'android-mcp'))
        self.assertEqual(server_package('uvx', ['--from', 'redis-mcp-server@0.5.1', 'redis-mcp-server']), ('pypi-uvx', 'redis-mcp-server@0.5.1'))

    def test_pipx_run(self):
        self.assertEqual(server_package('pipx', ['run', '--no-cache', 'nia-mcp-server']), ('pypi-pipx', 'nia-mcp-server'))

    def test_out_of_scope(self):
        self.assertIsNone(server_package('docker', ['run', '-i', 'img:1']))
        self.assertIsNone(server_package('', None))


class Specs(unittest.TestCase):
    def test_split(self):
        self.assertEqual(split_spec('npm', '@scope/pkg'), ('@scope/pkg', None))
        self.assertEqual(split_spec('npm', '@scope/pkg@latest'), ('@scope/pkg', 'latest'))
        self.assertEqual(split_spec('pypi-pipx', 'pkg==1.2.3'), ('pkg', '1.2.3'))
        self.assertEqual(split_spec('pypi-uvx', 'pkg@1.2.3'), ('pkg', '1.2.3'))

    def test_exact(self):
        for ok in ('1.2.3', '0.0.84', '2026.11.4', '1.0.0-beta.2'):
            self.assertTrue(EXACT.match(ok), ok)
        for bad in ('latest', '^1.2.3', '1.x', '1.2', ''):
            self.assertFalse(EXACT.match(bad), bad)

    def test_pinned_spec(self):
        self.assertEqual(pinned_spec('npm', 'a', '1.0.0'), 'a@1.0.0')
        self.assertEqual(pinned_spec('pypi-pipx', 'a', '1.0.0'), 'a==1.0.0')


if __name__ == '__main__':
    unittest.main()

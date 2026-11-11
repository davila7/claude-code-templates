#!/usr/bin/env python3
"""Exercise upstream catalog discovery in a disposable tree without network or uploads."""
import ast
import contextlib
import io
import json
import os
from pathlib import Path
import shutil
import tempfile
from collections import defaultdict

repo = Path(__file__).resolve().parents[4]
source = repo / 'scripts/generate_components_json.py'
namespace = {'os': os, 'json': json, 'shutil': shutil, 'Path': Path, 'defaultdict': defaultdict}
for definition in ast.parse(source.read_text()).body:
    if isinstance(definition, ast.FunctionDef) and definition.name in ('scan_directory_recursively', 'generate_components_json'):
        exec(compile(ast.Module(body=[definition], type_ignores=[]), str(source), 'exec'), namespace)
namespace['fetch_download_stats'] = lambda: {}
namespace['run_security_validation'] = lambda: {}
with tempfile.TemporaryDirectory(prefix='pudu-catalog-check-') as folder:
    target = Path(folder) / 'cli-tool/components/skills/development/pudu-task-telemetry'
    shutil.copytree(repo / 'cli-tool/components/skills/development/pudu-task-telemetry', target)
    # Upstream binds json locally only while processing a JSON component.
    fixture = Path(folder) / 'cli-tool/components/settings/testing/fixture.json'
    fixture.parent.mkdir(parents=True)
    fixture.write_text(json.dumps({'description': 'Synthetic catalog fixture'}))
    previous = Path.cwd()
    try:
        os.chdir(folder)
        Path('docs').mkdir()
        with contextlib.redirect_stdout(io.StringIO()):
            namespace['generate_components_json']()
        entry = json.loads(Path('docs/components.json').read_text())['skills'][0]
        assert entry['path'] == 'development/pudu-task-telemetry'
        assert entry['category'] == 'development'
        assert entry['name'] == 'pudu-task-telemetry'
        assert entry['description'].startswith('Measure local AI task latency')
        assert entry['keywords'] == ['pudu-ai', 'ollama', 'local-models', 'task-telemetry', 'benchmarking']
        assert 'scripts/pudu-task.mjs' in entry['references']
        assert 'references/task-schema.json' in entry['references']
        print('PASS: upstream catalog discovers skill and supporting files; checkout unchanged.')
    finally:
        os.chdir(previous)

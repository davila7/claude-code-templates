#!/usr/bin/env python3
"""Pre-push language gate — blocks `git push` / `gh pr create` when the OUTGOING
diff introduces Spanish in committed source/docs (English-only rule; Spanish only
in chat). Scans only ADDED lines of the diff, so it never re-flags pre-existing
debt — only what THIS push would introduce.

Signals: accented chars, ¿¡, CRÍTICO/ALTO/MEDIO/BAJO review-severity labels, and
≥2 Spanish comment words on a line. Allow-list: i18n/locale/unicode/non-ASCII
fixtures and lines tagged `EXEMPT-ES <reason>`.

Operability: FAIL-OPEN on any internal error (never brick a push on a hook bug).
Override: CLAUDE_LANG_GATE_OVERRIDE=1 (logged).
"""
import json, os, re, subprocess, sys

ACCENTS = re.compile(r'[áéíóúÁÉÍÓÚñÑ¿¡]')
SEVERITY = re.compile(r'\b(CRÍTICO|CRITICO)\b|\bALTO\b|\bMEDIO\b|\bBAJO\b')
WORDS = re.compile(r'\b(cuando|entonces|según|debe|deben|guardar|correo|correos|'
    r'horas|edición|edicion|añadir|anadir|revisión|revision|análisis|analisis|'
    r'obligatorio|siempre|nunca|prohibid\w+|archivo|proyecto|regla|reglas|'
    r'usuario|contraseña|botón|boton|el evento|la hora|para el|no se|está|'
    r'función|funcion|verificar que|asegurar|entorno|pruebas?)\b', re.IGNORECASE)
ALLOW = re.compile(r'i18n|locale|es-ES|es_ES|EXEMPT-ES|translation|unicode|non-ASCII',
                   re.IGNORECASE)
CODE_DOC = ('.py', '.js', '.jsx', '.ts', '.tsx', '.md', '.mjs', '.mts',
            '.json', '.yml', '.yaml', '.sh')


def is_spanish(line):
    if ALLOW.search(line):
        return None
    if ACCENTS.search(line):
        return 'accent'
    if SEVERITY.search(line):
        return 'severity'
    if len(WORDS.findall(line)) >= 2:
        return 'words'
    return None


def main():
    try:
        data = json.loads(sys.stdin.read())
        command = data.get('tool_input', {}).get('command', '') or ''
        cwd = data.get('cwd', '') or os.getcwd()
    except Exception:
        return 0

    if not ('git push' in command or 'gh pr create' in command):
        return 0
    # Override via ambient env OR inline in the command (PreToolUse hooks don't
    # inherit env vars set as an inline prefix, so accept the token in the string).
    if (os.environ.get('CLAUDE_LANG_GATE_OVERRIDE') == '1'
            or 'CLAUDE_LANG_GATE_OVERRIDE=1' in command):
        print('spanish-gate: override active — bypass logged', file=sys.stderr)
        return 0

    try:
        m = re.search(r'(?:^|&&|;)\s*cd\s+("[^"]+"|\'[^\']+\'|\S+)', command)
        repo = os.path.expanduser(m.group(1).strip('\'"')) if m else cwd
        top = subprocess.run(['git', '-C', repo, 'rev-parse', '--show-toplevel'],
                             capture_output=True, text=True, timeout=15)
        if top.returncode != 0:
            return 0
        repo = top.stdout.strip()

        diff = None
        for base in ('@{upstream}', 'origin/development', 'origin/dev',
                     'origin/main', 'origin/master',
                     'development', 'dev', 'main', 'master'):
            r = subprocess.run(['git', '-C', repo, 'diff', f'{base}...HEAD'],
                               capture_output=True, text=True, timeout=20)
            if r.returncode == 0:
                diff = r.stdout
                break
        if diff is None:
            return 0  # no comparable base — nothing to scan

        cur_file, findings = None, []
        for line in diff.splitlines():
            if line.startswith('+++ b/'):
                cur_file = line[6:]
            elif line.startswith('+') and not line.startswith('+++'):
                # Self-exempt: the detector scripts legitimately contain the Spanish
                # patterns they match against.
                if cur_file and os.path.basename(cur_file) in ('spanish-gate.py', 'spanish-scan.py'):
                    continue
                if cur_file and cur_file.endswith(CODE_DOC) and 'node_modules' not in cur_file:
                    kind = is_spanish(line[1:])
                    if kind:
                        findings.append((cur_file, kind, line[1:].strip()[:90]))

        if not findings:
            return 0

        out = ['⛔ LANGUAGE GATE — the outgoing diff introduces Spanish (English-only rule):', '']
        for f, kind, txt in findings[:12]:
            out.append(f'  {f}  [{kind}]  {txt}')
        if len(findings) > 12:
            out.append(f'  … +{len(findings) - 12} more')
        out += ['',
                '  Translate to English before pushing (severity labels → CRITICAL/HIGH/MEDIUM/LOW).',
                '  Intentional non-English (unicode/i18n fixtures): tag the line `EXEMPT-ES <reason>`.',
                '  Override (logged): CLAUDE_LANG_GATE_OVERRIDE=1']
        print('\n'.join(out), file=sys.stderr)
        return 2
    except Exception as exc:
        print(f'spanish-gate: internal error ({exc}) — allowing (fail-open)', file=sys.stderr)
        return 0


if __name__ == '__main__':
    sys.exit(main())

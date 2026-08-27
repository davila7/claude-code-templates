#!/usr/bin/env python3
"""Spanish-in-code scanner. Flags Spanish text in committed source/docs
(English-only rule; Spanish only in chat). Signals: accented chars, ¿¡,
CRÍTICO/ALTO/MEDIO/BAJO severity labels, and common Spanish comment words.

Usage:
  spanish-scan.py <path> [path...]     # scan given git-tracked files/dirs
  git -C <repo> ls-files | spanish-scan.py --stdin --repo <repo>
Exit 1 if any Spanish is found (for use as a gate), 0 if clean.
"""
import re, sys, os, subprocess

ACCENTS = re.compile(r'[áéíóúÁÉÍÓÚñÑ¿¡]')
SEVERITY = re.compile(r'\b(CRÍTICO|CRITICO)\b|\bALTO\b|\bMEDIO\b|\bBAJO\b')
WORDS = re.compile(r'\b(cuando|entonces|según|debe|deben|guardar|correo|correos|'
    r'horas|edición|edicion|añadir|anadir|revisión|revision|análisis|analisis|'
    r'obligatorio|siempre|nunca|prohibid\w+|archivo|proyecto|regla|reglas|'
    r'usuario|contraseña|fila|columna|botón|boton|nombre de|el evento|la hora|'
    r'para el|de la|no se|está|este método|función|funcion|verificar que|'
    r'asegurar|entorno|pruebas?)\b', re.IGNORECASE)
# Allow-list: intentional bilingual invocation triggers / product i18n markers.
ALLOW = re.compile(r'i18n|locale|es-ES|es_ES|EXEMPT-ES|translation|unicode|non-ASCII|spanish trigger', re.IGNORECASE)

def spanish_line(line):
    if ALLOW.search(line):
        return None
    if ACCENTS.search(line): return 'accent'
    if SEVERITY.search(line): return 'severity'
    if WORDS.search(line):
        # require ≥2 Spanish signal words to cut English false positives
        if len(WORDS.findall(line)) >= 2:
            return 'words'
    return None

def scan_file(path):
    hits = []
    try:
        with open(path, encoding='utf-8', errors='ignore') as f:
            for i, line in enumerate(f, 1):
                k = spanish_line(line)
                if k:
                    hits.append((i, k, line.strip()[:110]))
    except Exception:
        pass
    return hits

def tracked_files(paths):
    out = []
    for p in paths:
        if os.path.isdir(p):
            r = subprocess.run(['git','-C',p,'ls-files'], capture_output=True, text=True)
            out += [os.path.join(p, x) for x in r.stdout.splitlines()]
        else:
            out.append(p)
    return out

CODE_DOC = ('.py','.js','.jsx','.ts','.tsx','.md','.mjs','.mts','.json','.yml','.yaml','.sh')
found = 0
files = tracked_files(sys.argv[1:] or ['.'])
SELF = ('spanish-gate.py', 'spanish-scan.py')
for f in files:
    if not f.endswith(CODE_DOC): continue
    if 'node_modules' in f or '/.git/' in f: continue
    if os.path.basename(f) in SELF: continue  # the detectors contain the patterns they match
    hits = scan_file(f)
    if hits:
        found += len(hits)
        print(f"\n{f}  ({len(hits)})")
        for ln, kind, txt in hits[:6]:
            print(f"  {ln}:[{kind}] {txt}")
        if len(hits) > 6: print(f"  … +{len(hits)-6} more")
print(f"\n=== {found} Spanish line(s) across {len(files)} tracked files ===")
sys.exit(1 if found else 0)

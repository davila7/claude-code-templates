#!/usr/bin/env python3
"""
context-timeline: Claude Code session visualizer.

Modes (called by Claude Code hooks via stdin JSON):
  --server-start        SessionStart hook — launch daemon + open browser
  --event <NAME>        PreToolUse / PostToolUse / Stop hook — notify server
  --shutdown            Kill daemon manually
  --run-server <PORT>   Internal: daemon entry point (do not call directly)
"""
import argparse
import gzip
import io
import json
import os
import pathlib
import signal
import socket
import sys
import threading
import time
import webbrowser
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from queue import Empty, Queue
from urllib.parse import parse_qs, urlparse

# ── Constants ──────────────────────────────────────────────────────────────────

DEFAULT_PORT             = 7878
DEFAULT_CONTEXT_LIMIT    = 200_000
EXTENDED_CONTEXT_LIMIT   = 1_000_000
WATCHDOG_SECONDS         = 3600
CACHE_TTL                = 0.25

_STATE_DIR = pathlib.Path.home() / ".claude" / "state" / "context-timeline"

# ── Path helpers ───────────────────────────────────────────────────────────────

def _state_dir() -> pathlib.Path:
    _STATE_DIR.mkdir(parents=True, exist_ok=True)
    return _STATE_DIR

def _encode_cwd(cwd: str) -> str:
    return cwd.replace("/", "-")

def _transcript_path(session_id: str, cwd: str) -> pathlib.Path:
    base = pathlib.Path.home() / ".claude" / "projects" / _encode_cwd(cwd)
    return base / f"{session_id}.jsonl"

def _subagents_dir(session_id: str, cwd: str) -> pathlib.Path:
    base = pathlib.Path.home() / ".claude" / "projects" / _encode_cwd(cwd)
    return base / session_id / "subagents"

def _events_dir() -> pathlib.Path:
    d = _state_dir() / "events"
    d.mkdir(exist_ok=True)
    return d

def _pid_file()      -> pathlib.Path: return _state_dir() / "server.pid"
def _port_file()     -> pathlib.Path: return _state_dir() / "server.port"
def _log_file()      -> pathlib.Path: return _state_dir() / "server.log"
def _sessions_file() -> pathlib.Path: return _state_dir() / "sessions.json"

# ── Context limit detection ────────────────────────────────────────────────────

def _detect_context_limit(cwd: str) -> int:
    """Resolve the model context window in tokens.

    Resolution order:
      1. CONTEXT_TIMELINE_LIMIT env var (explicit override).
      2. "[1m]" / "[200k]" / "[1M]" suffix in the active model setting,
         read from <cwd>/.claude/settings.json or ~/.claude/settings.json.
      3. DEFAULT_CONTEXT_LIMIT (200_000).
    """
    env = os.environ.get("CONTEXT_TIMELINE_LIMIT")
    if env:
        try:
            return int(env)
        except ValueError:
            pass

    for path in (
        pathlib.Path(cwd) / ".claude" / "settings.json",
        pathlib.Path.home() / ".claude" / "settings.json",
    ):
        try:
            cfg   = json.loads(path.read_text())
            model = str(cfg.get("model", "")).lower()
            if "[1m]" in model or "[1000k]" in model:
                return EXTENDED_CONTEXT_LIMIT
            if "[200k]" in model:
                return DEFAULT_CONTEXT_LIMIT
        except (FileNotFoundError, OSError, ValueError, json.JSONDecodeError):
            continue

    return DEFAULT_CONTEXT_LIMIT

# ── Pid file ───────────────────────────────────────────────────────────────────

def _write_pid(pid: int, port: int):
    _pid_file().write_text(str(pid))
    _port_file().write_text(str(port))

def _read_pid():
    try:
        pid  = int(_pid_file().read_text().strip())
        port = int(_port_file().read_text().strip())
        return pid, port
    except Exception:
        return 0, DEFAULT_PORT

def _is_alive(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False

def _remove_pidfile():
    _pid_file().unlink(missing_ok=True)
    _port_file().unlink(missing_ok=True)

# ── Port ───────────────────────────────────────────────────────────────────────

def _pick_port() -> int:
    env = os.environ.get("CONTEXT_TIMELINE_PORT")
    if env:
        return int(env)
    for p in range(DEFAULT_PORT, DEFAULT_PORT + 11):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("127.0.0.1", p))
                return p
            except OSError:
                continue
    return DEFAULT_PORT

def _wait_for_port(port: int, timeout=5.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection(("127.0.0.1", port), timeout=0.2):
                return True
        except Exception:
            time.sleep(0.15)
    return False

# ── Session registry ───────────────────────────────────────────────────────────

_sessions: dict      = {}
_sessions_lock       = threading.Lock()

def _register_session(session_id: str, cwd: str, transcript: str | None):
    entry = {
        "cwd":             cwd,
        "transcript_path": transcript or str(_transcript_path(session_id, cwd)),
        "started_at":      time.time(),
    }
    with _sessions_lock:
        _sessions[session_id] = entry
    try:
        sf = _sessions_file()
        existing: dict = json.loads(sf.read_text()) if sf.exists() else {}
        existing[session_id] = entry
        sf.write_text(json.dumps(existing))
    except Exception:
        pass

def _load_sessions():
    try:
        sf = _sessions_file()
        if sf.exists():
            data = json.loads(sf.read_text())
            with _sessions_lock:
                _sessions.update(data)
    except Exception:
        pass

def _get_cwd(session_id: str):
    with _sessions_lock:
        s = _sessions.get(session_id)
    if not s:
        _load_sessions()  # daemon started before this session was registered
        with _sessions_lock:
            s = _sessions.get(session_id)
    return s["cwd"] if s else None

# ── JSONL incremental reader ───────────────────────────────────────────────────

class _Tail:
    def __init__(self):
        self._offsets: dict[str, int] = {}

    def read(self, path: pathlib.Path) -> list:
        key    = str(path)
        offset = self._offsets.get(key, 0)
        rows: list = []
        try:
            with open(path, "rb") as f:
                f.seek(offset)
                while True:
                    raw = f.readline()
                    if not raw:
                        break
                    offset = f.tell()
                    try:
                        rows.append(json.loads(raw.decode("utf-8", errors="replace")))
                    except json.JSONDecodeError:
                        pass
            self._offsets[key] = offset
        except (FileNotFoundError, OSError):
            pass
        return rows

# ── State builder ──────────────────────────────────────────────────────────────

def _tool_summary(name: str, inp: dict) -> str:
    if not inp:
        return ""
    if name == "Bash":
        return str(inp.get("command", ""))[:200]
    for k in ("file_path", "query", "pattern", "prompt", "description"):
        if k in inp:
            return str(inp[k])[:200]
    return str(inp)[:200]

def _parse_ts(line: dict) -> float:
    raw = line.get("timestamp", "")
    if raw:
        try:
            from datetime import datetime, timezone  # noqa: F401
            return datetime.fromisoformat(raw.replace("Z", "+00:00")).timestamp()
        except Exception:
            pass
    return time.time()

def _fresh_agent(aid: str, atype="", desc="") -> dict:
    return {
        "id": aid, "type": atype, "description": desc,
        "started_at": time.time(), "ended_at": None,
        "context": {
            "input_tokens": 0, "output_tokens": 0,
            "cache_read_input_tokens": 0, "cache_creation_input_tokens": 0,
            "total_used": 0,
        },
        "nodes": [],
    }

def _fresh_state(session_id: str, limit: int = DEFAULT_CONTEXT_LIMIT) -> dict:
    return {
        "session_id": session_id,
        "started_at": time.time(),
        "main": _fresh_agent("main"),
        "subagents": {},
        "context_window": {
            "input_tokens": 0, "output_tokens": 0,
            "cache_read_input_tokens": 0, "cache_creation_input_tokens": 0,
            "total_used": 0, "limit": limit,
            "last_update_ts": time.time(),
        },
        "edges": [],
        "version": 0,
    }

class _Builder:
    def __init__(self, session_id: str, cwd: str):
        self._sid   = session_id
        self._cwd   = cwd
        self._limit = _detect_context_limit(cwd)
        self._state = _fresh_state(session_id, self._limit)
        self._tail  = _Tail()

    def update(self) -> dict:
        s = self._state
        # Main transcript — skip sidechain lines
        for line in self._tail.read(_transcript_path(self._sid, self._cwd)):
            if not line.get("isSidechain", False):
                self._ingest(line, s["main"], s)
        # Subagent transcripts
        sub_dir = _subagents_dir(self._sid, self._cwd)
        if sub_dir.exists():
            for jf in sorted(sub_dir.glob("agent-*.jsonl")):
                aid = jf.stem
                if aid not in s["subagents"]:
                    meta: dict = {}
                    try:
                        meta = json.loads((sub_dir / f"{aid}.meta.json").read_text())
                    except Exception:
                        pass
                    s["subagents"][aid] = _fresh_agent(
                        aid, meta.get("agentType", ""), meta.get("description", "")
                    )
                    # Resolve oldest pending Task edge to this first new subagent
                    for edge in s["edges"]:
                        if edge["to_agent"] is None:
                            edge["to_agent"] = aid
                            break
                for line in self._tail.read(jf):
                    self._ingest(line, s["subagents"][aid], s)
        s["version"] += 1
        return s

    def _ingest(self, line: dict, agent: dict, s: dict):
        ltype = line.get("type", "")
        ts    = _parse_ts(line)
        if ts and ts < s["started_at"]:
            s["started_at"] = ts

        if ltype == "assistant":
            msg   = line.get("message") or {}
            usage = msg.get("usage") or {}
            if usage:
                ctx = {
                    "input_tokens":                usage.get("input_tokens", 0),
                    "output_tokens":               usage.get("output_tokens", 0),
                    "cache_read_input_tokens":     usage.get("cache_read_input_tokens", 0),
                    "cache_creation_input_tokens": usage.get("cache_creation_input_tokens", 0),
                }
                ctx["total_used"] = sum(ctx.values())
                agent["context"] = ctx
                if agent["id"] == "main":
                    s["context_window"].update({**ctx, "last_update_ts": ts, "limit": self._limit})
            for block in (msg.get("content") or []):
                if not isinstance(block, dict) or block.get("type") != "tool_use":
                    continue
                name = block.get("name", "")
                node = {
                    "uuid":               block.get("id", f"t{ts}"),
                    "parent_uuid":        line.get("parentUuid"),
                    "ts":                 ts,
                    "type":               "tool_use",
                    "tool_name":          name,
                    "tool_input_summary": _tool_summary(name, block.get("input") or {}),
                    "duration_ms":        None,
                    "status":             "pending",
                    "result_summary":     None,
                }
                agent["nodes"].append(node)
                if name in ("Task", "Agent"):
                    s["edges"].append({"from_node": node["uuid"], "to_agent": None, "ts": ts})

        elif ltype == "user":
            msg = line.get("message") or {}
            for item in (msg.get("content") or []):
                if not isinstance(item, dict) or item.get("type") != "tool_result":
                    continue
                tid      = item.get("tool_use_id", "")
                is_err   = bool(item.get("is_error"))
                content  = item.get("content", "")
                if isinstance(content, list):
                    content = " ".join(
                        str(c.get("text", "")) for c in content if isinstance(c, dict)
                    )
                summary = str(content)[:200]
                _Builder._complete(agent, tid, is_err, summary)
                for sub in s["subagents"].values():
                    _Builder._complete(sub, tid, is_err, summary)

    @staticmethod
    def _complete(agent: dict, tid: str, is_err: bool, result: str):
        for n in agent["nodes"]:
            if n["uuid"] == tid and n["status"] == "pending":
                n["status"]         = "error" if is_err else "ok"
                n["result_summary"] = result
                return

# ── Global server state ────────────────────────────────────────────────────────

_cache: dict        = {}   # session_id → (state, built_at)
_cache_lock         = threading.Lock()
_sse: dict          = {}   # session_id → list[Queue]
_sse_lock           = threading.Lock()
_builders: dict     = {}
_builders_lock      = threading.Lock()
_last_req           = [time.time()]

def _push_sse(sid: str, msg: dict):
    with _sse_lock:
        subs = list(_sse.get(sid, []))
    for q in subs:
        try: q.put_nowait(msg)
        except Exception: pass

def _get_state(sid: str, force=False) -> dict:
    with _cache_lock:
        cached = _cache.get(sid)
        if not force and cached and (time.time() - cached[1]) < CACHE_TTL:
            return cached[0]
    cwd = _get_cwd(sid)
    if not cwd:
        return {"error": "session_not_found", "session_id": sid, "version": 0}
    with _builders_lock:
        if sid not in _builders:
            _builders[sid] = _Builder(sid, cwd)
        b = _builders[sid]
    try:
        state = b.update()
    except Exception as e:
        state = {"error": str(e), "session_id": sid, "version": 0}
    with _cache_lock:
        _cache[sid] = (state, time.time())
    return state

# ── Background threads ─────────────────────────────────────────────────────────

def _wal_reaper():
    offsets: dict = {}
    while True:
        try:
            for f in _events_dir().glob("*.jsonl"):
                sid = f.stem
                off = offsets.get(str(f), 0)
                try:
                    with open(f, "rb") as fh:
                        fh.seek(off)
                        while True:
                            raw = fh.readline()
                            if not raw: break
                            off = fh.tell()
                            try:
                                json.loads(raw)
                                with _cache_lock:
                                    _cache.pop(sid, None)
                                _push_sse(sid, {"type": "refresh"})
                            except Exception:
                                pass
                    offsets[str(f)] = off
                except Exception:
                    pass
        except Exception:
            pass
        time.sleep(0.5)

def _watchdog():
    while True:
        time.sleep(60)
        if time.time() - _last_req[0] > WATCHDOG_SECONDS:
            os._exit(0)

# ── Embedded dashboard ─────────────────────────────────────────────────────────

_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Claude Timeline</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{
  --bg:#0d1117;--surface:#161b22;--surface2:#1c2128;--border:#30363d;--border2:#21262d;
  --text:#e6edf3;--muted:#8b949e;--muted2:#6e7681;
  --red:#f85149;--green:#3fb950;--orange:#d29922;--orange2:#fb923c;
  --cyan:#39c5cf;--purple:#bc8cff;--yellow:#e3b341;--blue:#58a6ff;--gray:#484f58;
  --track:#21262d;
}
body{background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;display:flex;flex-direction:column;height:100vh;overflow:hidden}

/* ─── Header ─────────────────────────────────────────────────────── */
header{background:var(--surface);border-bottom:1px solid var(--border);padding:10px 18px;display:flex;align-items:center;gap:14px;flex-shrink:0}
.live-dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 6px var(--green);flex-shrink:0;transition:all .3s}
.live-dot.stale{background:var(--muted);box-shadow:none}
.session-id{background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:3px 10px;font-size:12px;color:var(--muted);font-family:monospace;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0}
.cw-wrap{flex:1;display:flex;flex-direction:column;gap:3px;min-width:0}
.cw-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px}
.cw-track{height:8px;background:var(--track);border-radius:4px;overflow:hidden}
.cw-fill{height:100%;display:flex;transition:all .5s}
.cw-text{font-size:11px;color:var(--muted)}
.cw-text.warn{color:var(--red);font-weight:600}
.seg-cr{background:#1d4ed8}.seg-cc{background:#3b82f6}.seg-in{background:#94a3b8;opacity:.5}.seg-out{background:var(--orange2)}

/* ─── Layout ─────────────────────────────────────────────────────── */
main{flex:1;display:flex;overflow:hidden}
#scroll-area{flex:1;overflow:auto;padding:0;position:relative}
#graph{display:block;min-width:100%}

/* ─── Sidebar ─────────────────────────────────────────────────────── */
aside{width:320px;min-width:200px;max-width:75vw;flex-shrink:0;background:var(--surface);border-left:1px solid var(--border);overflow-y:auto;display:flex;flex-direction:column;gap:0}
.resizer{width:5px;flex-shrink:0;background:transparent;cursor:col-resize;position:relative;z-index:10;transition:background .15s}
.resizer::after{content:'';position:absolute;inset:0 -2px;background:transparent}
.resizer:hover,.resizer.active{background:var(--blue)}
.sb-section{padding:14px 16px;border-bottom:1px solid var(--border2)}
.sb-section h3{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;font-weight:600}
.meter-row{height:12px;background:var(--track);border-radius:6px;overflow:hidden;margin-bottom:5px}
.meter-fill{height:100%;display:flex;transition:all .5s}
.meter-label{font-size:12px;color:var(--text);font-weight:500}
.meter-label.warn{color:var(--red)}
.bkd-grid{display:grid;grid-template-columns:auto 1fr auto;gap:3px 8px;margin-top:8px;font-size:11px;color:var(--muted);align-items:center}
.bkd-dot{width:8px;height:8px;border-radius:50%;justify-self:center}
.bkd-val{text-align:right;font-family:monospace}
.agent-card{background:var(--bg);border:1px solid var(--border2);border-radius:8px;padding:10px 12px;margin-bottom:8px;transition:border-color .2s}
.agent-card:hover{border-color:var(--purple)}
.agent-type{font-size:13px;font-weight:600;color:var(--text);margin-bottom:2px}
.agent-desc{font-size:11px;color:var(--muted);margin-bottom:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.agent-bar{height:4px;background:var(--track);border-radius:2px;overflow:hidden;margin-bottom:4px}
.agent-bar-fill{height:100%;background:var(--purple);border-radius:2px;transition:width .4s}
.agent-tokens{font-size:11px;color:var(--muted2);font-family:monospace}
.empty-state{color:var(--muted);font-size:12px;padding:12px 0;text-align:center}

/* ─── Tooltip ─────────────────────────────────────────────────────── */
#tooltip{position:fixed;display:none;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:10px 14px;font-size:12px;max-width:320px;z-index:9999;pointer-events:none;box-shadow:0 8px 24px rgba(0,0,0,.5);line-height:1.6}
.tt-name{font-size:14px;font-weight:700;margin-bottom:4px}
.tt-sum{color:var(--muted);word-break:break-all;font-family:monospace;font-size:11px;margin-bottom:4px}
.tt-row{display:flex;gap:8px;align-items:center;font-size:11px}
.tt-dur{color:var(--cyan);font-family:monospace}
.tt-ok{color:var(--green)}.tt-err{color:var(--red)}.tt-pend{color:var(--yellow)}

/* ─── Legend ─────────────────────────────────────────────────────── */
.legend{display:flex;flex-wrap:wrap;gap:8px 14px;padding:7px 18px;border-top:1px solid var(--border);background:var(--surface);flex-shrink:0}
.leg-item{display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted)}
.leg-dot{width:9px;height:9px;border-radius:50%}

/* ─── Zoom bar ────────────────────────────────────────────────────── */
#zoom-bar{position:sticky;top:0;left:0;z-index:50;display:flex;align-items:center;gap:4px;padding:5px 10px;background:rgba(13,17,23,.92);backdrop-filter:blur(6px);border-bottom:1px solid var(--border2);flex-shrink:0}
.zb{background:var(--surface2);border:1px solid var(--border);color:var(--text);border-radius:4px;padding:2px 9px;cursor:pointer;font-size:12px;line-height:1.6;transition:background .15s}
.zb:hover{background:var(--border)}
#zoom-label{color:var(--muted);font-size:11px;min-width:38px;text-align:center;font-family:monospace}
#graph-wrap{transform-origin:top left;will-change:transform}
/* ─── Animations ─────────────────────────────────────────────────── */
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.2}}
.is-pending{animation:pulse 1.4s ease-in-out infinite}
</style>
</head>
<body>
<header>
  <div class="live-dot" id="dot"></div>
  <div class="session-id" id="chip">connecting…</div>
  <div class="cw-wrap">
    <div class="cw-label">Context Window</div>
    <div class="cw-track"><div class="cw-fill" id="hfill"></div></div>
    <div class="cw-text" id="htxt">—</div>
  </div>
</header>

<main>
  <div id="scroll-area">
    <div id="zoom-bar">
      <button class="zb" id="zoom-out">−</button>
      <span id="zoom-label">100%</span>
      <button class="zb" id="zoom-in">+</button>
      <button class="zb" id="zoom-fit">Fit</button>
      <span style="color:var(--muted2);font-size:10px;margin-left:4px">Ctrl+scroll</span>
    </div>
    <div id="graph-wrap">
      <svg id="graph" xmlns="http://www.w3.org/2000/svg"></svg>
    </div>
  </div>
  <div class="resizer" id="resizer" title="Drag to resize"></div>
  <aside id="sidebar">
    <div class="sb-section">
      <h3>Context Window</h3>
      <div class="meter-row"><div class="meter-fill" id="smeter"></div></div>
      <div class="meter-label" id="smtxt">—</div>
      <div class="bkd-grid" id="bkd"></div>
    </div>
    <div class="sb-section" style="flex:1">
      <h3>Subagents</h3>
      <div id="subs"></div>
    </div>
  </aside>
</main>

<div class="legend" id="leg"></div>
<div id="tooltip"></div>

<script>
// ─── Config ───────────────────────────────────────────────────────────────────
const TOOL_COLORS={
  Read:'#3fb950',Write:'#fb923c',Edit:'#fb923c',MultiEdit:'#fb923c',
  Bash:'#f85149',Grep:'#39c5cf',Glob:'#39c5cf',
  Task:'#bc8cff',Agent:'#bc8cff',
  WebFetch:'#e3b341',WebSearch:'#e3b341',
  _default:'#484f58'
};
const TOOL_ICONS={
  Read:'R',Write:'W',Edit:'E',MultiEdit:'M',Bash:'$',Grep:'/',Glob:'*',
  Task:'T',Agent:'A',WebFetch:'↗',WebSearch:'⌕',_default:'·'
};
const LIM=200000;
// Layout constants — pill-card style
const MARGIN_TOP=52;     // space for column headers
const MARGIN_BOT=32;
const NODE_H=36;         // pill height
const NODE_W=170;        // pill width
const NODE_GAP=14;       // gap between pills
const NODE_STEP=NODE_H+NODE_GAP;  // 50px per node
const TRACK_X_OFFSET=16; // vertical track x within column area
const PILL_X_OFFSET=32;  // pill starts this many px right of track
const COL_W=NODE_W+PILL_X_OFFSET+24; // total column width
const COL_PAD=20;        // left margin for first column

let sid=new URLSearchParams(location.search).get('session')||'';
let lastVer=-1;
let firstRender=true;

function tc(name){return TOOL_COLORS[name]||TOOL_COLORS._default}
function ti(name){return TOOL_ICONS[name]||TOOL_ICONS._default}
function fmt(n){return(n||0).toLocaleString()}
function pct(a,b){return b?((a/b)*100).toFixed(1)+'%':'0%'}
function trunc(s,n){return s&&s.length>n?s.slice(0,n)+'…':s||''}

// ─── Legend ───────────────────────────────────────────────────────────────────
(()=>{
  const items=[['Bash','$'],['Read','R'],['Edit','E'],['Agent/Task','A'],['Grep','*'],['Web','↗'],['Other','·']];
  const colors=[tc('Bash'),tc('Read'),tc('Edit'),tc('Agent'),tc('Grep'),tc('WebFetch'),TOOL_COLORS._default];
  document.getElementById('leg').innerHTML=items.map(([l],i)=>
    `<div class="leg-item"><div class="leg-dot" style="background:${colors[i]}"></div>${l}</div>`
  ).join('');
})();

// ─── Bar rendering ─────────────────────────────────────────────────────────────
function renderCWBar(cw,fillId,txtId,isSidebar){
  if(!cw)return;
  const tot=cw.total_used||0,lim=cw.limit||LIM;
  const p=Math.min(tot/lim,1);
  const cr=cw.cache_read_input_tokens||0,cc=cw.cache_creation_input_tokens||0;
  const inp=cw.input_tokens||0,out=cw.output_tokens||0;
  const sum=cr+cc+inp+out||1;
  document.getElementById(fillId).innerHTML=
    `<div class="seg-cr" style="width:${(cr/sum*p*100).toFixed(2)}%"></div>`+
    `<div class="seg-cc" style="width:${(cc/sum*p*100).toFixed(2)}%"></div>`+
    `<div class="seg-in" style="width:${(inp/sum*p*100).toFixed(2)}%"></div>`+
    `<div class="seg-out" style="width:${(out/sum*p*100).toFixed(2)}%"></div>`;
  const el=document.getElementById(txtId);
  const warn=p>.85;
  el.className=(isSidebar?'meter-label':'cw-text')+(warn?' warn':'');
  el.textContent=`${fmt(tot)} / ${fmt(lim)} (${pct(tot,lim)})`;
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function renderSidebar(st){
  renderCWBar(st.context_window,'smeter','smtxt',true);
  const cw=st.context_window||{};
  const rows=[
    ['#1d4ed8','Cache read',cw.cache_read_input_tokens||0],
    ['#3b82f6','Cache create',cw.cache_creation_input_tokens||0],
    ['#94a3b880','Input',cw.input_tokens||0],
    ['#fb923c','Output',cw.output_tokens||0],
  ];
  document.getElementById('bkd').innerHTML=rows.map(([c,l,v])=>
    `<div class="bkd-dot" style="background:${c}"></div><span>${l}</span><span class="bkd-val">${fmt(v)}</span>`
  ).join('');
  const subs=Object.values(st.subagents||{});
  const sl=document.getElementById('subs');
  if(!subs.length){sl.innerHTML='<div class="empty-state">No subagents yet</div>';return;}
  sl.innerHTML=subs.map(a=>{
    const tok=a.context?.total_used||0;
    const p=Math.min(tok/LIM*100,100).toFixed(1);
    const nodes=a.nodes?.length||0;
    return `<div class="agent-card">
      <div class="agent-type">${a.type||'subagent'}</div>
      <div class="agent-desc" title="${a.description||''}">${trunc(a.description||a.id,42)}</div>
      <div class="agent-bar"><div class="agent-bar-fill" style="width:${p}%"></div></div>
      <div class="agent-tokens">${fmt(tok)} tokens · ${nodes} calls</div>
    </div>`;
  }).join('');
}

// ─── Graph ────────────────────────────────────────────────────────────────────
function renderGraph(st){
  const svg=document.getElementById('graph');
  const scroll=document.getElementById('scroll-area');

  // Build agent list: main first, then subagents in order
  const agents=['main',...Object.keys(st.subagents||{})];
  const agIdx={};agents.forEach((a,i)=>{agIdx[a]=i;});
  const colX=aid=>COL_PAD+agIdx[aid]*COL_W;  // left edge of column area
  const trackX=aid=>colX(aid)+TRACK_X_OFFSET; // vertical line x
  const pillX=aid=>colX(aid)+PILL_X_OFFSET;   // pill left edge

  // All nodes sorted oldest→newest (oldest = large y, newest = small y)
  const getNodes=aid=>{
    const ag=aid==='main'?st.main:(st.subagents||{})[aid];
    return(ag?.nodes||[]).map(n=>({n,aid}));
  };
  const allPairs=agents.flatMap(getNodes).sort((a,b)=>(a.n.ts||0)-(b.n.ts||0));
  const total=allPairs.length;

  if(!total){
    const svgW=Math.max(500,agents.length*COL_W+COL_PAD*2);
    const svgH=300;
    svg.dataset.baseW=svgW;svg.dataset.baseH=svgH;
    svg.setAttribute('width',svgW);svg.setAttribute('height',svgH);
    svg.setAttribute('viewBox',`0 0 ${svgW} ${svgH}`);
    svg.innerHTML=`<text x="${svgW/2}" y="150" fill="#484f58" font-size="14" text-anchor="middle" font-family="sans-serif">Waiting for tool calls…</text>`;
    return;
  }

  // Assign y-positions: newest at top (MARGIN_TOP), oldest at bottom
  const nodeY={};
  allPairs.forEach(({n},i)=>{
    // i=0 oldest → bottom; i=total-1 newest → top
    nodeY[n.uuid]=MARGIN_TOP+(total-1-i)*NODE_STEP;
  });

  const svgH=MARGIN_TOP+(total-1)*NODE_STEP+NODE_H+MARGIN_BOT;
  const svgW=Math.max(600,agents.length*COL_W+COL_PAD*2+32);

  let out='';

  // ── Column headers ──────────────────────────────────────────────────────
  agents.forEach(aid=>{
    const tx=trackX(aid);
    const ag=aid==='main'?st.main:(st.subagents||{})[aid];
    const label=aid==='main'?'main':((ag?.type||'agent').slice(0,16));
    const nodeCount=(ag?.nodes||[]).length;
    // Header badge
    out+=`<rect x="${tx-10}" y="4" width="${NODE_W+20}" height="28" rx="6" fill="#21262d" stroke="#30363d" stroke-width="1"/>`;
    out+=`<text x="${tx+NODE_W/2-10}" y="22" fill="#e6edf3" font-size="12" font-weight="600" text-anchor="middle" font-family="sans-serif">${label}</text>`;
    if(nodeCount){
      out+=`<text x="${tx+NODE_W-5}" y="22" fill="#484f58" font-size="10" text-anchor="end" font-family="monospace">${nodeCount}</text>`;
    }
  });

  // ── Vertical track lines ────────────────────────────────────────────────
  agents.forEach(aid=>{
    const ag=aid==='main'?st.main:(st.subagents||{})[aid];
    const agNodes=(ag?.nodes||[]);
    if(!agNodes.length)return;
    const sorted=[...agNodes].sort((a,b)=>(a.ts||0)-(b.ts||0));
    const yTop=nodeY[sorted[sorted.length-1].uuid];
    const yBot=nodeY[sorted[0].uuid]+NODE_H/2;
    const tx=trackX(aid);
    const lc=aid==='main'?'#30363d':'#2d1f4a';
    out+=`<line x1="${tx}" y1="${yTop+NODE_H/2}" x2="${tx}" y2="${yBot}" stroke="${lc}" stroke-width="2" stroke-linecap="round"/>`;
  });

  // ── Branch edges (Agent → subagent) ────────────────────────────────────
  for(const edge of(st.edges||[])){
    if(!edge.to_agent||nodeY[edge.from_node]===undefined)continue;
    const fromTX=trackX('main');
    const fromY=nodeY[edge.from_node]+NODE_H/2;
    const sub=(st.subagents||{})[edge.to_agent];
    if(!sub)continue;
    const sn=[...(sub.nodes||[])].sort((a,b)=>(a.ts||0)-(b.ts||0));
    if(!sn.length)continue;
    const toTX=trackX(edge.to_agent);
    const toY=nodeY[sn[sn.length-1].uuid]+NODE_H/2;
    const mx=(fromTX+toTX)/2;
    out+=`<path d="M${fromTX},${fromY} C${mx},${fromY} ${mx},${toY} ${toTX},${toY}"
      fill="none" stroke="#bc8cff" stroke-width="2" stroke-dasharray="5,3" opacity="0.5"/>`;
    // Small arrow endpoint
    out+=`<circle cx="${toTX}" cy="${toY}" r="4" fill="#bc8cff" opacity="0.7"/>`;
  }

  // ── Node pills ──────────────────────────────────────────────────────────
  for(const {n,aid} of allPairs){
    const y=nodeY[n.uuid];
    if(y===undefined)continue;
    const tx=trackX(aid);
    const px=pillX(aid);
    const col=tc(n.tool_name);
    const icon=ti(n.tool_name);
    const pend=n.status==='pending';
    const err=n.status==='error';

    // Track connector dot
    out+=`<circle cx="${tx}" cy="${y+NODE_H/2}" r="5" fill="${col}" opacity="${pend?.4:1}"/>`;
    if(pend){
      out+=`<circle cx="${tx}" cy="${y+NODE_H/2}" r="5" fill="${col}" class="is-pending" opacity=".6"/>`;
    }

    // Horizontal connector line from track to pill
    out+=`<line x1="${tx+5}" y1="${y+NODE_H/2}" x2="${px}" y2="${y+NODE_H/2}" stroke="${col}" stroke-width="1.5" opacity=".4"/>`;

    // Pill background
    const pillCls=pend?'is-pending':'';
    const bgOpacity=pend?.06:.12;
    out+=`<rect class="${pillCls}" x="${px}" y="${y}" width="${NODE_W}" height="${NODE_H}" rx="6"
      fill="${col}" fill-opacity="${bgOpacity}"
      stroke="${col}" stroke-opacity="${err?.9:.35}" stroke-width="${err?2:1}"/>`;

    // Color accent bar (left)
    out+=`<rect x="${px}" y="${y}" width="4" height="${NODE_H}" rx="3" fill="${col}"/>`;

    // Icon badge
    out+=`<rect x="${px+8}" y="${y+8}" width="20" height="20" rx="4" fill="${col}" fill-opacity=".18"/>`;
    out+=`<text x="${px+18}" y="${y+22}" fill="${col}" font-size="11" font-weight="700" text-anchor="middle" font-family="monospace">${icon}</text>`;

    // Tool name
    out+=`<text x="${px+34}" y="${y+14}" fill="${col}" font-size="12" font-weight="600" font-family="sans-serif" dominant-baseline="middle">${n.tool_name||'unknown'}</text>`;

    // Summary
    const sumText=trunc(n.tool_input_summary||'',22);
    if(sumText){
      out+=`<text x="${px+34}" y="${y+26}" fill="#6e7681" font-size="10" font-family="monospace" dominant-baseline="middle">${sumText}</text>`;
    }

    // Duration badge (top-right of pill)
    if(n.duration_ms!=null){
      const dur=n.duration_ms>=1000?(n.duration_ms/1000).toFixed(1)+'s':n.duration_ms+'ms';
      out+=`<text x="${px+NODE_W-8}" y="${y+13}" fill="#484f58" font-size="9" text-anchor="end" font-family="monospace">${dur}</text>`;
    }

    // Status indicator (bottom-right)
    const statusColor=err?'#f85149':pend?'#e3b341':'#3fb950';
    out+=`<circle cx="${px+NODE_W-8}" cy="${y+NODE_H-8}" r="3.5" fill="${statusColor}" opacity="${pend?.6:1}"/>`;

    // Invisible hit area for tooltip
    out+=`<rect x="${px}" y="${y}" width="${NODE_W}" height="${NODE_H}" rx="6" fill="transparent"
      data-uuid="${n.uuid}" data-tool="${n.tool_name||''}"
      data-sum="${encodeURIComponent(n.tool_input_summary||'')}"
      data-dur="${n.duration_ms||''}" data-st="${n.status}" style="cursor:pointer"/>`;
  }

  // Store base dimensions for zoom (zoom scales these)
  svg.dataset.baseW=svgW;
  svg.dataset.baseH=svgH;
  const z=window._zoom?window._zoom():1;
  svg.setAttribute('width',Math.round(svgW*z));
  svg.setAttribute('height',Math.round(svgH*z));
  svg.setAttribute('viewBox',`0 0 ${svgW} ${svgH}`);
  svg.innerHTML=out;

  // ── Tooltip ──────────────────────────────────────────────────────────────
  const tip=document.getElementById('tooltip');
  svg.querySelectorAll('rect[data-uuid]').forEach(el=>{
    el.addEventListener('mousemove',e=>{
      const tool=el.dataset.tool;
      const sum=decodeURIComponent(el.dataset.sum||'');
      const dur=el.dataset.dur;
      const st2=el.dataset.st;
      const statusCls=st2==='ok'?'tt-ok':st2==='error'?'tt-err':'tt-pend';
      tip.innerHTML=
        `<div class="tt-name" style="color:${tc(tool)}">${tool||'unknown'}</div>`+
        (sum?`<div class="tt-sum">${sum.slice(0,260)}</div>`:'')+
        `<div class="tt-row">`+
        (dur?`<span class="tt-dur">⏱ ${dur}ms</span>`:'<span class="tt-dur">pending</span>')+
        `<span class="${statusCls}">● ${st2||'?'}</span></div>`;
      tip.style.display='block';
      const left=Math.min(e.clientX+16,window.innerWidth-340);
      tip.style.left=left+'px';
      tip.style.top=(e.clientY-8)+'px';
    });
    el.addEventListener('mouseleave',()=>{tip.style.display='none';});
  });

  // Only scroll to top on first render; preserve position on updates
  if(firstRender){scroll.scrollTop=0;firstRender=false;}
}

// ─── Main render ──────────────────────────────────────────────────────────────
function render(st){
  if(!st||st.error)return;
  const changed=st.version!==lastVer;
  // Always update header (cheap)
  document.getElementById('chip').textContent=st.session_id||sid;
  document.getElementById('dot').className='live-dot';
  renderCWBar(st.context_window,'hfill','htxt',false);
  if(!changed)return;  // skip heavy graph/sidebar re-render if nothing changed
  lastVer=st.version;
  renderSidebar(st);
  renderGraph(st);
}

async function fetchState(){
  if(!sid)return;
  try{
    const r=await fetch('/api/state?session='+encodeURIComponent(sid));
    if(!r.ok)throw new Error(r.status);
    render(await r.json());
  }catch{
    document.getElementById('dot').className='live-dot stale';
  }
}

function setupSSE(){
  if(!sid){
    document.getElementById('chip').textContent='No session — open with ?session=<id>';
    return;
  }
  const connect=()=>{
    const es=new EventSource('/api/stream?session='+encodeURIComponent(sid));
    es.onmessage=()=>fetchState();
    es.onerror=()=>{
      es.close();
      document.getElementById('dot').className='live-dot stale';
      setTimeout(connect,4000);
    };
  };
  connect();
}

// ─── Zoom ─────────────────────────────────────────────────────────────────────
(()=>{
  let zoom=1;
  const MIN=0.12,MAX=2.5,STEP=0.12;
  const wrap=document.getElementById('graph-wrap');
  const lbl=document.getElementById('zoom-label');

  function applyZoom(){
    // Scale the SVG element via width/height attributes (keeps scroll range correct)
    const svg=document.getElementById('graph');
    const bw=parseFloat(svg.dataset.baseW||svg.getAttribute('width')||600);
    const bh=parseFloat(svg.dataset.baseH||svg.getAttribute('height')||400);
    svg.setAttribute('width',Math.round(bw*zoom));
    svg.setAttribute('height',Math.round(bh*zoom));
    lbl.textContent=Math.round(zoom*100)+'%';
  }

  function zoomTo(z){zoom=Math.max(MIN,Math.min(MAX,z));applyZoom();}
  function zoomFit(){
    const svg=document.getElementById('graph');
    const bw=parseFloat(svg.dataset.baseW||svg.getAttribute('width')||600);
    const bh=parseFloat(svg.dataset.baseH||svg.getAttribute('height')||400);
    const scroll=document.getElementById('scroll-area');
    const aw=scroll.clientWidth,ah=scroll.clientHeight-40;
    zoomTo(Math.min(aw/bw,ah/bh));
    scroll.scrollTop=0;scroll.scrollLeft=0;
  }

  document.getElementById('zoom-in').addEventListener('click',()=>zoomTo(zoom+STEP));
  document.getElementById('zoom-out').addEventListener('click',()=>zoomTo(zoom-STEP));
  document.getElementById('zoom-fit').addEventListener('click',zoomFit);

  // Ctrl/Cmd + scroll
  document.getElementById('scroll-area').addEventListener('wheel',e=>{
    if(!e.ctrlKey&&!e.metaKey)return;
    e.preventDefault();
    zoomTo(zoom+(e.deltaY<0?STEP:-STEP));
  },{passive:false});

  // Expose so renderGraph can tag base dimensions
  window._zoomApply=applyZoom;
  window._zoom=()=>zoom;
})();

// ─── Resizable sidebar ────────────────────────────────────────────────────────
(()=>{
  const resizer=document.getElementById('resizer');
  const sidebar=document.getElementById('sidebar');
  let dragging=false;
  resizer.addEventListener('mousedown',e=>{
    dragging=true;
    resizer.classList.add('active');
    document.body.style.cursor='col-resize';
    document.body.style.userSelect='none';
    e.preventDefault();
  });
  document.addEventListener('mousemove',e=>{
    if(!dragging)return;
    const maxW=Math.floor(window.innerWidth*.75);
    const newW=Math.max(200,Math.min(maxW,window.innerWidth-e.clientX));
    sidebar.style.width=newW+'px';
  });
  document.addEventListener('mouseup',()=>{
    if(!dragging)return;
    dragging=false;
    resizer.classList.remove('active');
    document.body.style.cursor='';
    document.body.style.userSelect='';
  });
})();

setupSSE();
fetchState();
setInterval(fetchState,3000);
</script>
</body>
</html>"""

# ── HTTP handler ───────────────────────────────────────────────────────────────

class _Handler(BaseHTTPRequestHandler):
    def log_message(self, *_): pass

    def _send(self, code, ct, body: bytes, extra=None):
        self.send_response(code)
        self.send_header("Content-Type", ct)
        self.send_header("Content-Length", len(body))
        self.send_header("Access-Control-Allow-Origin", "*")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        _last_req[0] = time.time()
        parsed = urlparse(self.path)
        qs     = parse_qs(parsed.query)
        path   = parsed.path

        if path in ("/", ""):
            body = _HTML.encode("utf-8")
            if "gzip" in self.headers.get("Accept-Encoding", ""):
                buf = io.BytesIO()
                with gzip.GzipFile(fileobj=buf, mode="wb") as gz:
                    gz.write(body)
                body = buf.getvalue()
                self._send(200, "text/html; charset=utf-8", body, {"Content-Encoding": "gzip"})
            else:
                self._send(200, "text/html; charset=utf-8", body)
            return

        if path == "/api/state":
            sids = qs.get("session", [])
            if not sids:
                self._send(400, "application/json", b'{"error":"missing session"}')
                return
            state = _get_state(sids[0])
            self._send(200, "application/json", json.dumps(state, default=str).encode())
            return

        if path == "/api/stream":
            sids = qs.get("session", [])
            if not sids:
                self._send(400, "text/plain", b"missing session")
                return
            sid_val = sids[0]
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            q = Queue()
            with _sse_lock:
                _sse.setdefault(sid_val, []).append(q)
            try:
                while True:
                    try:
                        msg = q.get(timeout=15)
                        self.wfile.write(f"data: {json.dumps(msg)}\n\n".encode())
                        self.wfile.flush()
                    except Empty:
                        self.wfile.write(b": ping\n\n")
                        self.wfile.flush()
            except Exception:
                pass
            finally:
                with _sse_lock:
                    subs = _sse.get(sid_val, [])
                    if q in subs:
                        subs.remove(q)
            return

        if path == "/api/sessions":
            with _sessions_lock:
                data = list(_sessions.keys())
            self._send(200, "application/json", json.dumps(data).encode())
            return

        self._send(404, "text/plain", b"not found")

    def do_POST(self):
        _last_req[0] = time.time()
        if self.path == "/event":
            length = int(self.headers.get("Content-Length", 0))
            body   = self.rfile.read(length) if length else b"{}"
            try:
                data = json.loads(body)
                sid_val = data.get("session_id", "")
                if sid_val:
                    with _cache_lock:
                        _cache.pop(sid_val, None)
                    _push_sse(sid_val, {"type": "refresh"})
            except Exception:
                pass
            self._send(200, "application/json", b'{"ok":true}')
            return
        self._send(404, "text/plain", b"not found")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET,POST,OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

# ── Server process ─────────────────────────────────────────────────────────────

def _run_server(port: int):
    _load_sessions()
    _write_pid(os.getpid(), port)
    threading.Thread(target=_wal_reaper, daemon=True).start()
    threading.Thread(target=_watchdog,   daemon=True).start()
    httpd = ThreadingHTTPServer(("127.0.0.1", port), _Handler)
    httpd.serve_forever()

def _spawn_daemon(port: int):
    log = str(_log_file())
    if os.name == "posix":
        pid = os.fork()
        if pid > 0:
            return  # parent
        os.setsid()
        pid2 = os.fork()
        if pid2 > 0:
            os._exit(0)  # intermediate child
        # Grandchild (daemon): redirect stdio
        dev  = open(os.devnull, "rb")
        logf = open(log, "a")
        os.dup2(dev.fileno(),  0)
        os.dup2(logf.fileno(), 1)
        os.dup2(logf.fileno(), 2)
        _run_server(port)
        os._exit(0)
    else:
        import subprocess
        DETACHED = 0x00000008
        NEW_GRP  = 0x00000200
        NO_WIN   = 0x08000000
        logf = open(log, "a")
        subprocess.Popen(
            [sys.executable, __file__, "--run-server", str(port)],
            creationflags=DETACHED | NEW_GRP | NO_WIN,
            stdout=logf, stderr=logf, stdin=subprocess.DEVNULL,
            close_fds=True,
        )

# ── Modes ──────────────────────────────────────────────────────────────────────

def _maybe_open_browser(session_id: str, port: int):
    url = f"http://127.0.0.1:{port}/"
    if session_id:
        url += f"?session={session_id}"
    if os.environ.get("CONTEXT_TIMELINE_NO_BROWSER") == "1":
        print(f"[context-timeline] Dashboard: {url}", file=sys.stderr)
    else:
        webbrowser.open(url, new=0, autoraise=False)

def mode_server_start():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        payload = {}
    session_id = payload.get("session_id", "")
    cwd        = payload.get("cwd") or os.getcwd()
    transcript = payload.get("transcript_path")

    if session_id:
        _register_session(session_id, cwd, transcript)

    pid, port = _read_pid()
    if _is_alive(pid):
        _maybe_open_browser(session_id, port)
        return

    _remove_pidfile()
    port = _pick_port()
    _spawn_daemon(port)

    if _wait_for_port(port, timeout=5.0):
        _maybe_open_browser(session_id, port)
    else:
        print(f"[context-timeline] Server failed to start. Log: {_log_file()}", file=sys.stderr)

def mode_event(event_name: str):
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return
    session_id = payload.get("session_id", "")
    if not session_id:
        return
    enriched = {**payload, "event": event_name, "received_at": time.time()}
    # WAL (survive POST failure)
    try:
        ef = _events_dir() / f"{session_id}.jsonl"
        with open(ef, "a") as f:
            f.write(json.dumps(enriched) + "\n")
    except Exception:
        pass
    # Best-effort notify server
    _, port = _read_pid()
    try:
        data = json.dumps(enriched).encode()
        req  = urllib.request.Request(
            f"http://127.0.0.1:{port}/event",
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=0.2)
    except Exception:
        pass

def mode_shutdown():
    pid, _ = _read_pid()
    if _is_alive(pid):
        try:
            os.kill(pid, signal.SIGTERM)
        except Exception:
            pass
        for _ in range(25):
            time.sleep(0.1)
            if not _is_alive(pid):
                break
        if _is_alive(pid):
            try:
                os.kill(pid, signal.SIGKILL)
            except Exception:
                pass
    _remove_pidfile()
    print("[context-timeline] Shutdown complete.", file=sys.stderr)

# ── Main ───────────────────────────────────────────────────────────────────────

def main():
    ap = argparse.ArgumentParser(description="context-timeline")
    ap.add_argument("--server-start", action="store_true")
    ap.add_argument("--event",        metavar="NAME")
    ap.add_argument("--shutdown",     action="store_true")
    ap.add_argument("--run-server",   metavar="PORT", type=int)
    args = ap.parse_args()

    if args.server_start:
        mode_server_start()
    elif args.event:
        mode_event(args.event)
    elif args.shutdown:
        mode_shutdown()
    elif args.run_server:
        _run_server(args.run_server)
    else:
        ap.print_help()

if __name__ == "__main__":
    main()

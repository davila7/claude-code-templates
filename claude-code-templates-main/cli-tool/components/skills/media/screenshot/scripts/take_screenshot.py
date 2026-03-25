#!/usr/bin/env python3
"""Cross-platform screenshot helper for Codex skills."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import platform
import shutil
import subprocess
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
MAC_PERM_SCRIPT = SCRIPT_DIR / "macos_permissions.swift"
MAC_PERM_HELPER = SCRIPT_DIR / "ensure_macos_permissions.sh"
MAC_WINDOW_SCRIPT = SCRIPT_DIR / "macos_window_info.swift"
MAC_DISPLAY_SCRIPT = SCRIPT_DIR / "macos_display_info.swift"
TEST_MODE_ENV = "CODEX_SCREENSHOT_TEST_MODE"
TEST_PLATFORM_ENV = "CODEX_SCREENSHOT_TEST_PLATFORM"
TEST_WINDOWS_ENV = "CODEX_SCREENSHOT_TEST_WINDOWS"
TEST_DISPLAYS_ENV = "CODEX_SCREENSHOT_TEST_DISPLAYS"
TEST_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\x0cIDAT\x08\xd7c"
    b"\xf8\xff\xff?\x00\x05\xfe\x02\xfeA\xad\x1c\x1c\x00\x00\x00\x00IEND"
    b"\xaeB`\x82"
)


def parse_region(value: str) -> tuple[int, int, int, int]:
    parts = [p.strip() for p in value.split(",")]
    if len(parts) != 4:
        raise argparse.ArgumentTypeError("region must be x,y,w,h")
    try:
        x, y, w, h = (int(p) for p in parts)
    except ValueError as exc:
        raise argparse.ArgumentTypeError("region values must be integers") from exc
    if w <= 0 or h <= 0:
        raise argparse.ArgumentTypeError("region width and height must be positive")
    return x, y, w, h


def test_mode_enabled() -> bool:
    value = os.environ.get(TEST_MODE_ENV, "")
    return value.lower() in {"1", "true", "yes", "on"}


def normalize_platform(value: str) -> str:
    lowered = value.strip().lower()
    if lowered in {"darwin", "mac", "macos", "osx"}:
        return "Darwin"
    if lowered in {"linux", "ubuntu"}:
        return "Linux"
    if lowered in {"windows", "win"}:
        return "Windows"
    return value


def test_platform_override() -> str | None:
    value = os.environ.get(TEST_PLATFORM_ENV)
    if value:
        return normalize_platform(value)
    return None


def parse_int_list(value: str) -> list[int]:
    results: list[int] = []
    for part in value.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            results.append(int(part))
        except ValueError:
            continue
    return results


def test_window_ids() -> list[int]:
    value = os.environ.get(TEST_WINDOWS_ENV, "101,102")
    ids = parse_int_list(value)
    return ids or [101]


def test_display_ids() -> list[int]:
    value = os.environ.get(TEST_DISPLAYS_ENV, "1,2")
    ids = parse_int_list(value)
    return ids or [1]


def write_test_png(path: Path) -> None:
    ensure_parent(path)
    path.write_bytes(TEST_PNG)


def timestamp() -> str:
    return dt.datetime.now().strftime("%Y-%m-%d_%H-%M-%S")


def default_filename(fmt: str, prefix: str = "screenshot") -> str:
    return f"{prefix}-{timestamp()}.{fmt}"


def mac_default_dir() -> Path:
    desktop = Path.home() / "Desktop"
    try:
        proc = subprocess.run(
            ["defaults", "read", "com.apple.screencapture", "location"],
            check=False,
            capture_output=True,
            text=True,
        )
        location = proc.stdout.strip()
        if location:
            return Path(location).expanduser()
    except OSError:
        pass
    return desktop


def default_dir(system: str) -> Path:
    home = Path.home()
    if system == "Darwin":
        return mac_default_dir()
    if system == "Windows":
        pictures = home / "Pictures"
        screenshots = pictures / "Screenshots"
        if screenshots.exists():
            return screenshots
        if pictures.exists():
            return pictures
        return home
    pictures = home / "Pictures"
    screenshots = pictures / "Screenshots"
    if screenshots.exists():
        return screenshots
    if pictures.exists():
        return pictures
    return home


def ensure_parent(path: Path) -> None:
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
    except OSError:
        # Fall back to letting the capture command report a clearer error.
        pass


def resolve_output_path(
    requested_path: str | None, mode: str, fmt: str, system: str
) -> Path:
    if requested_path:
        path = Path(requested_path).expanduser()
        if path.exists() and path.is_dir():
            path = path / default_filename(fmt)
        elif requested_path.endswith(("/", "\\")) and not path.exists():
            path.mkdir(parents=True, exist_ok=True)
            path = path / default_filename(fmt)
        elif path.suffix == "":
            path = path.with_suffix(f".{fmt}")
        ensure_parent(path)
        return path

    if mode == "temp":
        tmp_dir = Path(tempfile.gettempdir())
        tmp_path = tmp_dir / default_filename(fmt, prefix="codex-shot")
        ensure_parent(tmp_path)
        return tmp_path

    dest_dir = default_dir(system)
    dest_path = dest_dir / default_filename(fmt)
    ensure_parent(dest_path)
    return dest_path


def multi_output_paths(base: Path, suffixes: list[str]) -> list[Path]:
    if len(suffixes) <= 1:
        return [base]
    paths: list[Path] = []
    for suffix in suffixes:
        candidate = base.with_name(f"{base.stem}-{suffix}{base.suffix}")
        ensure_parent(candidate)
        paths.append(candidate)
    return paths


def run(cmd: list[str]) -> None:
    try:
        subprocess.run(cmd, check=True)
    except FileNotFoundError as exc:
        raise SystemExit(f"required command not found: {cmd[0]}") from exc
    except subprocess.CalledProcessError as exc:
        raise SystemExit(f"command failed ({exc.returncode}): {' '.join(cmd)}") from exc


def swift_json(script: Path, extra_args: list[str] | None = None) -> dict:
    module_cache = Path(tempfile.gettempdir()) / "codex-swift-module-cache"
    module_cache.mkdir(parents=True, exist_ok=True)
    cmd = ["swift", "-module-cache-path", str(module_cache), str(script)]
    if extra_args:
        cmd.extend(extra_args)
    try:
        proc = subprocess.run(cmd, check=True, capture_output=True, text=True)
    except FileNotFoundError as exc:
        raise SystemExit("swift not found; install Xcode command line tools") from exc
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or "").strip()
        if "ModuleCache" in stderr and "Operation not permitted" in stderr:
            raise SystemExit(
                "swift needs module-cache access; rerun with escalated permissions"
            ) from exc
        msg = stderr or (exc.stdout or "").strip() or "swift helper failed"
        raise SystemExit(msg) from exc
    try:
        return json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise SystemExit(f"swift helper returned invalid JSON: {proc.stdout.strip()}") from exc


def macos_screen_capture_granted(request: bool = False) -> bool:
    args = ["--request"] if request else []
    payload = swift_json(MAC_PERM_SCRIPT, args)
    return bool(payload.get("screenCapture"))


def ensure_macos_permissions() -> None:
    if os.environ.get("CODEX_SANDBOX"):
        raise SystemExit(
            "screen capture checks are blocked in the sandbox; rerun with escalated permissions"
        )
    if macos_screen_capture_granted():
        return
    subprocess.run(["bash", str(MAC_PERM_HELPER)], check=False)
    if not macos_screen_capture_granted():
        raise SystemExit(
            "Screen Recording permission is required; enable it in System Settings and retry"
        )


def activate_app(app: str) -> None:
    safe_app = app.replace('"', '\\"')
    script = f'tell application "{safe_app}" to activate'
    subprocess.run(["osascript", "-e", script], check=False, capture_output=True, text=True)


def macos_window_payload(args: argparse.Namespace, frontmost: bool, include_list: bool) -> dict:
    flags: list[str] = []
    if frontmost:
        flags.append("--frontmost")
    if args.app:
        flags.extend(["--app", args.app])
    if args.window_name:
        flags.extend(["--window-name", args.window_name])
    if include_list:
        flags.append("--list")
    return swift_json(MAC_WINDOW_SCRIPT, flags)


def macos_display_indexes() -> list[int]:
    payload = swift_json(MAC_DISPLAY_SCRIPT)
    displays = payload.get("displays") or []
    indexes: list[int] = []
    for item in displays:
        try:
            value = int(item)
        except (TypeError, ValueError):
            continue
        if value > 0:
            indexes.append(value)
    return indexes or [1]


def macos_window_ids(args: argparse.Namespace, capture_all: bool) -> list[int]:
    payload = macos_window_payload(
        args,
        frontmost=args.active_window,
        include_list=capture_all,
    )
    if capture_all:
        windows = payload.get("windows") or []
        ids: list[int] = []
        for item in windows:
            win_id = item.get("id")
            if win_id is None:
                continue
            try:
                ids.append(int(win_id))
            except (TypeError, ValueError):
                continue
        if ids:
            return ids
    selected = payload.get("selected") or {}
    win_id = selected.get("id")
    if win_id is not None:
        try:
            return [int(win_id)]
        except (TypeError, ValueError):
            pass
    raise SystemExit("no matching macOS window found; try --list-windows to inspect ids")


def list_macos_windows(args: argparse.Namespace) -> None:
    payload = macos_window_payload(args, frontmost=args.active_window, include_list=True)
    windows = payload.get("windows") or []
    if not windows:
        print("no matching windows found")
        return
    for item in windows:
        bounds = item.get("bounds") or {}
        name = item.get("name") or ""
        width = bounds.get("width", 0)
        height = bounds.get("height", 0)
        x = bounds.get("x", 0)
        y = bounds.get("y", 0)
        print(f"{item.get('id')}\t{item.get('owner')}\t{name}\t{width}x{height}+{x}+{y}")


def list_test_macos_windows(args: argparse.Namespace) -> None:
    owner = args.app or "TestApp"
    name = args.window_name or ""
    ids = test_window_ids()
    if args.active_window and ids:
        ids = [ids[0]]
    for idx, win_id in enumerate(ids, start=1):
        window_name = name or f"Window {idx}"
        print(f"{win_id}\t{owner}\t{window_name}\t800x600+0+0")


def resolve_macos_windows(args: argparse.Namespace) -> list[int]:
    if args.app:
        activate_app(args.app)
    capture_all = not args.active_window
    return macos_window_ids(args, capture_all=capture_all)


def resolve_test_macos_windows(args: argparse.Namespace) -> list[int]:
    ids = test_window_ids()
    if args.active_window and ids:
        return [ids[0]]
    return ids


def capture_macos(
    args: argparse.Namespace,
    output: Path,
    *,
    window_id: int | None = None,
    display: int | None = None,
) -> None:
    cmd = ["screencapture", "-x", f"-t{args.format}"]
    if args.interactive:
        cmd.append("-i")
    if display is not None:
        cmd.append(f"-D{display}")
    effective_window_id = window_id if window_id is not None else args.window_id
    if effective_window_id is not None:
        cmd.append(f"-l{effective_window_id}")
    elif args.region is not None:
        x, y, w, h = args.region
        cmd.append(f"-R{x},{y},{w},{h}")
    cmd.append(str(output))
    run(cmd)


def capture_linux(args: argparse.Namespace, output: Path) -> None:
    scrot = shutil.which("scrot")
    gnome = shutil.which("gnome-screenshot")
    imagemagick = shutil.which("import")
    xdotool = shutil.which("xdotool")

    if args.region is not None:
        x, y, w, h = args.region
        if scrot:
            run(["scrot", "-a", f"{x},{y},{w},{h}", str(output)])
            return
        if imagemagick:
            geometry = f"{w}x{h}+{x}+{y}"
            run(["import", "-window", "root", "-crop", geometry, str(output)])
            return
        raise SystemExit("region capture requires scrot or ImageMagick (import)")

    if args.window_id is not None:
        if imagemagick:
            run(["import", "-window", str(args.window_id), str(output)])
            return
        raise SystemExit("window-id capture requires ImageMagick (import)")

    if args.active_window:
        if scrot:
            run(["scrot", "-u", str(output)])
            return
        if gnome:
            run(["gnome-screenshot", "-w", "-f", str(output)])
            return
        if imagemagick and xdotool:
            win_id = (
                subprocess.check_output(["xdotool", "getactivewindow"], text=True)
                .strip()
            )
            run(["import", "-window", win_id, str(output)])
            return
        raise SystemExit("active-window capture requires scrot, gnome-screenshot, or import+xdotool")

    if scrot:
        run(["scrot", str(output)])
        return
    if gnome:
        run(["gnome-screenshot", "-f", str(output)])
        return
    if imagemagick:
        run(["import", "-window", "root", str(output)])
        return
    raise SystemExit("no supported screenshot tool found (scrot, gnome-screenshot, or import)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--path",
        help="output file path or directory; overrides --mode",
    )
    parser.add_argument(
        "--mode",
        choices=("default", "temp"),
        default="default",
        help="default saves to the OS screenshot location; temp saves to the temp dir",
    )
    parser.add_argument(
        "--format",
        default="png",
        help="image format/extension (default: png)",
    )
    parser.add_argument(
        "--app",
        help="macOS only: capture all matching on-screen windows for this app name",
    )
    parser.add_argument(
        "--window-name",
        help="macOS only: substring match for a window title (optionally scoped by --app)",
    )
    parser.add_argument(
        "--list-windows",
        action="store_true",
        help="macOS only: list matching window ids instead of capturing",
    )
    parser.add_argument(
        "--region",
        type=parse_region,
        help="capture region as x,y,w,h (pixel coordinates)",
    )
    parser.add_argument(
        "--window-id",
        type=int,
        help="capture a specific window id when supported",
    )
    parser.add_argument(
        "--active-window",
        action="store_true",
        help="capture the focused/active window only when supported",
    )
    parser.add_argument(
        "--interactive",
        action="store_true",
        help="use interactive selection where the OS tool supports it",
    )
    args = parser.parse_args()

    if args.region and args.window_id is not None:
        raise SystemExit("choose either --region or --window-id, not both")
    if args.region and args.active_window:
        raise SystemExit("choose either --region or --active-window, not both")
    if args.window_id is not None and args.active_window:
        raise SystemExit("choose either --window-id or --active-window, not both")
    if args.app and args.window_id is not None:
        raise SystemExit("choose either --app or --window-id, not both")
    if args.region and args.app:
        raise SystemExit("choose either --region or --app, not both")
    if args.region and args.window_name:
        raise SystemExit("choose either --region or --window-name, not both")
    if args.interactive and args.app:
        raise SystemExit("choose either --interactive or --app, not both")
    if args.interactive and args.window_name:
        raise SystemExit("choose either --interactive or --window-name, not both")
    if args.interactive and args.window_id is not None:
        raise SystemExit("choose either --interactive or --window-id, not both")
    if args.interactive and args.active_window:
        raise SystemExit("choose either --interactive or --active-window, not both")
    if args.list_windows and (args.region or args.window_id is not None or args.interactive):
        raise SystemExit("--list-windows only supports --app, --window-name, and --active-window")

    test_mode = test_mode_enabled()
    system = platform.system()
    if test_mode:
        override = test_platform_override()
        if override:
            system = override
    window_ids: list[int] = []
    display_ids: list[int] = []

    if system != "Darwin" and (args.app or args.window_name or args.list_windows):
        raise SystemExit("--app/--window-name/--list-windows are supported on macOS only")

    if system == "Darwin":
        if test_mode:
            if args.list_windows:
                list_test_macos_windows(args)
                return
            if args.window_id is not None:
                window_ids = [args.window_id]
            elif args.app or args.window_name or args.active_window:
                window_ids = resolve_test_macos_windows(args)
            elif args.region is None and not args.interactive:
                display_ids = test_display_ids()
        else:
            ensure_macos_permissions()
            if args.list_windows:
                list_macos_windows(args)
                return
            if args.window_id is not None:
                window_ids = [args.window_id]
            elif args.app or args.window_name or args.active_window:
                window_ids = resolve_macos_windows(args)
            elif args.region is None and not args.interactive:
                display_ids = macos_display_indexes()

    output = resolve_output_path(args.path, args.mode, args.format, system)

    if test_mode:
        if system == "Darwin":
            if window_ids:
                suffixes = [f"w{wid}" for wid in window_ids]
                paths = multi_output_paths(output, suffixes)
                for path in paths:
                    write_test_png(path)
                for path in paths:
                    print(path)
                return
            if len(display_ids) > 1:
                suffixes = [f"d{did}" for did in display_ids]
                paths = multi_output_paths(output, suffixes)
                for path in paths:
                    write_test_png(path)
                for path in paths:
                    print(path)
                return
        write_test_png(output)
        print(output)
        return

    if system == "Darwin":
        if window_ids:
            suffixes = [f"w{wid}" for wid in window_ids]
            paths = multi_output_paths(output, suffixes)
            for wid, path in zip(window_ids, paths):
                capture_macos(args, path, window_id=wid)
            for path in paths:
                print(path)
            return
        if len(display_ids) > 1:
            suffixes = [f"d{did}" for did in display_ids]
            paths = multi_output_paths(output, suffixes)
            for did, path in zip(display_ids, paths):
                capture_macos(args, path, display=did)
            for path in paths:
                print(path)
            return
        capture_macos(args, output)
    elif system == "Linux":
        capture_linux(args, output)
    elif system == "Windows":
        raise SystemExit(
            "Windows support lives in scripts/take_screenshot.ps1; run it with PowerShell"
        )
    else:
        raise SystemExit(f"unsupported platform: {system}")

    print(output)


if __name__ == "__main__":
    main()

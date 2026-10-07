"""User-level bridge settings: one small JSON file in the per-user state folder.

The file is ``settings.json`` next to the artifacts (see ``state.state_root``), so it follows the same
resolution as every other piece of state and survives moving or updating the skill. It holds choices the
user makes once for every task, not task contents::

    {"schema_version": 1, "auto_review": true}

A setting that is absent (or ``null``) is *unset*: the bridge has not been told the user's choice yet.
``SETTINGS`` is the registry of known settings; adding a toggle means adding one entry there (and a field
to the documentation), not changing the file format. A key the registry does not know is left in the file
untouched when another setting is saved, and ``show`` lists it, so a newer release's file is not damaged by
an older one. A file written by a newer schema version is refused rather than guessed at.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .gitops import BridgeError, atomic_write_json
from .state import PACKAGE_ROOT, ensure_state_root, require_external_storage, state_root

SETTINGS_NAME = "settings.json"
SCHEMA_VERSION = 1
TRUE_WORDS = frozenset({"on", "true", "enabled"})
FALSE_WORDS = frozenset({"off", "false", "disabled"})


class SettingsError(BridgeError):
    """The settings file or a settings command argument is not usable."""


@dataclass(frozen=True)
class Setting:
    key: str            # the key in settings.json
    name: str           # how the command line spells it
    summary: str
    question: str       # what the lead asks the user while the setting is unset


SETTINGS: dict[str, Setting] = {
    "auto_review": Setting(
        key="auto_review", name="auto-review",
        summary="Route a worker's sandbox-boundary approval requests to Codex's automatic reviewer "
                "(Codex calls this Approve for me) instead of refusing them",
        question="Do you want Codex auto-review (Approve for me) enabled or disabled?"),
}


class SettingsRequired(BridgeError):
    """A setting the user has not chosen yet is needed before a worker can launch (nothing was started)."""

    def __init__(self, setting: Setting):
        super().__init__(f"the {setting.key} setting is not set yet: ask the user, record the answer with the "
                         f"settings command, then repeat this command")
        self.setting = setting

    def result(self) -> dict[str, Any]:
        return {"status": "settings_required", "nothing_started": True, "error": str(self),
                **guidance(self.setting), "then": "repeat the command that returned this result"}


def guidance(setting: Setting) -> dict[str, Any]:
    """What the lead needs to ask the user about an unset setting and to record the answer."""
    launcher = f'python -B "{PACKAGE_ROOT / "scripts" / "codex_bridge.py"}"'
    return {"setting": setting.key, "question": setting.question, "options": ["enabled", "disabled"],
            "record_with": {"enabled": f"{launcher} settings set {setting.name} on",
                            "disabled": f"{launcher} settings set {setting.name} off"}}


def settings_path() -> Path:
    return state_root() / SETTINGS_NAME


def known_names() -> str:
    return ", ".join(setting.name for setting in SETTINGS.values())


def find_setting(name: str) -> Setting:
    """The registered setting for a command-line or file spelling (``auto-review`` or ``auto_review``)."""
    folded = str(name).strip().lower().replace("_", "-")
    for setting in SETTINGS.values():
        if folded == setting.name:
            return setting
    raise SettingsError(f"unknown setting {str(name)!r}; known settings: {known_names()}")


def parse_toggle(value: str) -> bool:
    folded = str(value).strip().lower()
    if folded in TRUE_WORDS:
        return True
    if folded in FALSE_WORDS:
        return False
    raise SettingsError(f"unknown value {str(value)!r}; use on, off, true, false, enabled or disabled")


def read_file(path: Path | None = None) -> dict[str, Any]:
    """The decoded settings file, or an empty document when there is none. Never creates anything."""
    path = path or settings_path()
    try:
        value = json.loads(path.read_text(encoding="utf-8-sig"))
    except FileNotFoundError:
        return {"schema_version": SCHEMA_VERSION}
    except (OSError, ValueError) as exc:
        raise SettingsError(f"settings file is unreadable: {path} ({type(exc).__name__}: {exc}); fix or delete "
                            "it, then ask the user again") from exc
    if not isinstance(value, dict):
        raise SettingsError(f"settings file is not a JSON object: {path}")
    version = value.get("schema_version", SCHEMA_VERSION)
    if isinstance(version, bool) or not isinstance(version, int) or version < 1:
        raise SettingsError(f"settings file has an invalid schema_version: {path}")
    if version > SCHEMA_VERSION:
        raise SettingsError(f"settings file {path} was written by a newer version of this skill "
                            f"(schema {version}, this one reads {SCHEMA_VERSION}); update the skill")
    for setting in SETTINGS.values():
        found = value.get(setting.key)
        if found is not None and not isinstance(found, bool):
            raise SettingsError(f"{setting.key} in {path} must be true or false, not {found!r}; fix it with "
                                f"`settings set {setting.name} on|off`")
    return value


def load(path: Path | None = None) -> dict[str, Any]:
    """Every known setting as ``{key: True | False | None}`` (None is unset), plus the keys it does not know."""
    document = read_file(path)
    return {"values": {key: document.get(key) for key in SETTINGS},
            "ignored_keys": sorted(k for k in document if k != "schema_version" and k not in SETTINGS)}


def get(key: str) -> bool | None:
    return load()["values"][find_setting(key).key]


def require(key: str) -> bool:
    """The user's choice for ``key``; ``SettingsRequired`` while there is none."""
    setting = find_setting(key)
    require_external_storage(state_root())  # an unusable state folder is reported as that, not as an unset choice
    value = load()["values"][setting.key]
    if value is None:
        raise SettingsRequired(setting)
    return value


def _save(updates: dict[str, bool | None]) -> Path:
    ensure_state_root()
    path = settings_path()
    document = read_file(path)  # an unreadable or newer file stops the write instead of being overwritten
    document["schema_version"] = SCHEMA_VERSION
    for key, value in updates.items():
        if value is None:
            document.pop(key, None)
        else:
            document[key] = value
    atomic_write_json(path, document)
    return path


def set_value(name: str, value: str) -> dict[str, Any]:
    setting = find_setting(name)
    _save({setting.key: parse_toggle(value)})
    return show()


def unset_value(name: str) -> dict[str, Any]:
    setting = find_setting(name)
    if settings_path().exists():
        _save({setting.key: None})
    return show()


def state_of(value: bool | None) -> str:
    return "unset" if value is None else ("on" if value else "off")


def show() -> dict[str, Any]:
    path = settings_path()
    loaded = load(path)
    values = loaded["values"]
    result: dict[str, Any] = {
        "status": "ok", "settings_file": str(path), "exists": path.is_file(), "schema_version": SCHEMA_VERSION,
        "settings": {key: values[key] for key in SETTINGS},
        "state": {key: state_of(values[key]) for key in SETTINGS},
        "unset": [key for key in SETTINGS if values[key] is None],
        "commands": {setting.key: f"settings set {setting.name} on|off" for setting in SETTINGS.values()},
    }
    if loaded["ignored_keys"]:
        result["ignored_keys"] = loaded["ignored_keys"]
    return result


def run_command(action: str, name: str | None, value: str | None) -> dict[str, Any]:
    """The ``settings`` subcommand: ``show``, ``set <name> <value>`` or ``unset <name>``."""
    if action == "show":
        if name is not None or value is not None:
            raise SettingsError("settings show takes no arguments")
        return show()
    if action not in {"set", "unset"}:
        raise SettingsError(f"unknown settings action {action!r}: use show, set or unset")
    if name is None:
        raise SettingsError(f"settings {action} needs a setting name: {known_names()}")
    if action == "unset":
        if value is not None:
            raise SettingsError("settings unset takes only a setting name")
        return unset_value(name)
    if value is None:
        raise SettingsError(f"settings set needs a value for {find_setting(name).name}: on or off")
    return set_value(name, value)


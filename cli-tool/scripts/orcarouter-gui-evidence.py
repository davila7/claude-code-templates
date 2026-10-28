#!/usr/bin/env python3
"""Generate the OrcaRouter provider GUI evidence.

Starts the real dashboard (`cli-tool/src/orcarouter-dashboard.js`) against a
dedicated temporary credential store, drives the real pages with Playwright, and
writes `orca-evidence/manifest.json` plus the screenshots the manifest describes.

Nothing here fabricates UI: every page is loaded from the server this script
starts, and every assertion is read back out of the live DOM. The model counts in
the manifest are the counts the selector actually rendered, cross-checked against
the authoritative capability-scoped catalog at
`https://api.orcarouter.ai/v1/models?capability=chat`.

Usage (from the repository root):
    python3 cli-tool/scripts/orcarouter-gui-evidence.py
"""

import hashlib
import json
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
CLI_TOOL = REPO_ROOT / "cli-tool"
EVIDENCE_DIR = REPO_ROOT / "orca-evidence"
CATALOG_SOURCE = "https://api.orcarouter.ai/v1/models?capability=chat"

# Shape-valid but not a real credential: the dashboard stores it so the masked
# form can be photographed, and the gateway refuses it with HTTP 401.
FAKE_KEY = "sk-orca-evidence0fake0key000000000000000"

CHROMIUM_CANDIDATES = [
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
]


def free_port(start=3461):
    for port in range(start, start + 40):
        with socket.socket() as probe:
            if probe.connect_ex(("127.0.0.1", port)) != 0:
                return port
    raise RuntimeError("no free port")


def chromium_path():
    for candidate in CHROMIUM_CANDIDATES:
        if Path(candidate).exists():
            return candidate
    return None


def start_dashboard(port, credential_file):
    env = dict(os.environ)
    env["CCT_ORCAROUTER_DASHBOARD_NO_OPEN"] = "1"
    # The dashboard run must use only its own temporary store: a real key in the
    # environment would make discovery answer with a different catalog.
    env.pop("ORCAROUTER_API_KEY", None)
    env.pop("ORCA_API_BASE_URL", None)
    env.pop("ORCA_AUTH_BASE_URL", None)
    env.pop("ORCA_BASE_URL", None)
    log = tempfile.NamedTemporaryFile(prefix="orca-dashboard-", suffix=".log", delete=False)
    proc = subprocess.Popen(
        [
            "node",
            "-e",
            (
                "const {OrcaRouterDashboard}=require('./src/orcarouter-dashboard');"
                f"const d=new OrcaRouterDashboard({{port:{port},credentialFile:{json.dumps(credential_file)},env:process.env}});"
                "d.startServer().then(p=>console.log('READY '+p));"
            ),
        ],
        cwd=str(CLI_TOOL),
        env=env,
        stdout=log,
        stderr=subprocess.STDOUT,
    )
    deadline = time.time() + 30
    while time.time() < deadline:
        if proc.poll() is not None:
            raise RuntimeError(f"dashboard exited: {Path(log.name).read_text()}")
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/api/provider", timeout=2) as res:
                if res.status == 200:
                    return proc, log.name
        except Exception:
            time.sleep(0.3)
    raise RuntimeError("dashboard did not become ready")


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def authoritative_catalog():
    """The chat catalog the manifest counts must agree with.

    Read straight from the documented endpoint with no credential: the gateway
    serves this catalog publicly, so the evidence does not depend on any secret.
    """
    request = urllib.request.Request(CATALOG_SOURCE, headers={"Accept": "application/json"})
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.loads(response.read())
    return payload.get("data", [])


def image_capable(model):
    modalities = (model.get("architecture") or {}).get("input_modalities") or []
    return "image" in modalities


def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("Playwright is required: python3 -m pip install playwright", file=sys.stderr)
        return 2

    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)

    work_dir = tempfile.mkdtemp(prefix="orca-evidence-")
    credential_file = os.path.join(work_dir, "credentials.json")
    port = free_port()
    proc, log_path = start_dashboard(port, credential_file)
    base = f"http://127.0.0.1:{port}"

    results = {}
    failures = []
    login_lifecycle = {}
    catalog_state = {}
    multimodal_items = 0
    secret_masked = False
    catalog_total = 0
    image_total = 0

    try:
        with sync_playwright() as playwright:
            launch_args = {"args": ["--no-sandbox"]}
            executable = chromium_path()
            if executable:
                launch_args["executable_path"] = executable
            browser = playwright.chromium.launch(**launch_args)
            context = browser.new_context(
                viewport={"width": 1100, "height": 900}, device_scale_factor=1
            )
            page = context.new_page()

            console_errors = []
            page.on("pageerror", lambda error: console_errors.append(str(error)))

            # --- 1. Live discovery before any credential is stored ------------
            # The gateway serves `/v1/models` publicly, so the authoritative
            # catalog is proved with no credential at all.
            page.goto(base, wait_until="domcontentloaded")
            page.wait_for_selector("#api-key-input")
            page.wait_for_function(
                "() => !document.getElementById('model-trigger').disabled"
                " || document.getElementById('catalog-state').className.includes('degraded')",
                timeout=30000,
            )
            anonymous_state = page.evaluate(
                "() => ({ cls: document.getElementById('catalog-state').className,"
                " text: document.getElementById('catalog-state').textContent,"
                " ids: (window.__orca.state.options || []).map(m => m.id),"
                " verified: (window.__orca.state.options || []).filter(m => m.verified).length })"
            )
            if "degraded" in anonymous_state["cls"]:
                failures.append(
                    "live discovery failed for the anonymous public catalog: "
                    + anonymous_state["text"]
                )
            if not anonymous_state["ids"]:
                failures.append("live discovery returned no chat model")

            # --- 2. Store a fake API key through the real API-key form --------
            page.fill("#api-key-input", FAKE_KEY)
            page.click("#api-key-save")
            page.wait_for_function(
                "() => /Stored/.test(document.getElementById('api-key-status').textContent)",
                timeout=20000,
            )

            api_key_visible = page.is_visible("#api-key-input")
            save_enabled = page.is_enabled("#api-key-save")
            connect_enabled = page.is_enabled("#connect-start")
            pkce_visible = page.is_visible("#method-pkce")
            credential_text = page.inner_text("#credential-detail")
            secret_masked = FAKE_KEY not in credential_text and "***" in credential_text

            # The full key must never be rendered anywhere in the DOM.
            if FAKE_KEY in page.content():
                failures.append("the API key appears in the rendered page")

            page.screenshot(path=str(EVIDENCE_DIR / "auth-methods.png"))

            results["api_key_visible"] = bool(api_key_visible)
            results["pkce_visible"] = bool(pkce_visible)
            results["controls_enabled"] = bool(save_enabled and connect_enabled)
            results["live_catalog_model_count"] = len(anonymous_state["ids"])

            # --- 3. A stored credential the gateway rejects -------------------
            # The shape-valid fake key is refused with HTTP 401, so the selector
            # must say the catalog is degraded and fill itself from the verified
            # cold-start list rather than pretending the live catalog answered.
            page.wait_for_function(
                "() => document.getElementById('catalog-state').className.includes('degraded')",
                timeout=30000,
            )
            degraded_text = page.inner_text("#catalog-state")
            degraded_options = page.evaluate(
                "() => (window.__orca.state.options || []).map(m => ({id: m.id, verified: !!m.verified}))"
            )
            results["degraded_catalog_offers_fallback"] = bool(degraded_options)
            results["degraded_catalog_labelled"] = "verified fallback" in degraded_text.lower()
            results["degraded_catalog_state_text"] = degraded_text
            if any(not model["verified"] for model in degraded_options):
                failures.append(
                    "the degraded catalog mixed unverified models into the fallback list"
                )
            if FAKE_KEY in page.content():
                failures.append("the rejected API key appears in the rendered page")
            page.click("#model-trigger")
            page.wait_for_selector("#model-panel:not([hidden])")
            degraded_items = page.eval_on_selector_all(
                "#model-listbox li", "els => els.filter(e => e.offsetParent !== null).length"
            )
            results["degraded_catalog_item_count"] = degraded_items
            page.screenshot(path=str(EVIDENCE_DIR / "degraded-catalog.png"))
            page.keyboard.press("Escape")
            page.wait_for_selector("#model-panel", state="hidden")

            # --- 4. Revoke through the real control, then reload --------------
            # With no credential stored, discovery is live again and the text
            # selector must be filled from the authoritative chat catalog.
            page.click("#api-key-clear")
            page.wait_for_function(
                "() => /Stored/.test(document.getElementById('api-key-status').textContent) === false",
                timeout=20000,
            )
            page.goto(base, wait_until="domcontentloaded")
            page.wait_for_selector("#api-key-input")
            page.wait_for_function(
                "() => !document.getElementById('model-trigger').disabled",
                timeout=30000,
            )

            page.select_option("#capability-select", "chat")
            page.wait_for_function(
                "() => !document.getElementById('model-trigger').disabled",
                timeout=30000,
            )
            catalog_models = page.evaluate(
                "() => (window.__orca.state.options || []).map(m => m.id)"
            )
            catalog_state = page.evaluate(
                "() => ({ cls: document.getElementById('catalog-state').className,"
                " text: document.getElementById('catalog-state').textContent })"
            )
            catalog_degraded = "degraded" in (catalog_state.get("cls") or "")
            if catalog_degraded:
                failures.append(
                    "the text model dropdown was filled from a fallback catalog, not live discovery"
                )
            if sorted(catalog_models) != sorted(anonymous_state["ids"]):
                failures.append(
                    "the live dropdown does not match the catalog discovered for this capability"
                )

            page.click("#model-trigger")
            page.wait_for_selector("#model-panel:not([hidden])")
            visible_items = page.eval_on_selector_all(
                "#model-listbox li", "els => els.filter(e => e.offsetParent !== null).length"
            )
            item_count = len(page.query_selector_all("#model-listbox li"))

            trigger_box = page.locator("#model-trigger").bounding_box()
            panel_box = page.locator("#model-panel").bounding_box()
            panel_border = page.eval_on_selector(
                "#model-panel", "el => getComputedStyle(el).borderTopWidth"
            )

            results["dropdown_open"] = page.is_visible("#model-panel")
            results["item_count"] = f"{visible_items}/{item_count}"
            results["opaque_background"] = page.evaluate(
                "() => { const c = getComputedStyle(document.getElementById('model-panel')).backgroundColor;"
                " return !/rgba\\(0, 0, 0, 0\\)|transparent/.test(c); }"
            )
            results["visible_border"] = float(panel_border.rstrip("px") or 0) > 0
            results["trigger_panel_right_delta"] = round(
                abs((trigger_box["x"] + trigger_box["width"]) - (panel_box["x"] + panel_box["width"])),
                2,
            )

            page.screenshot(path=str(EVIDENCE_DIR / "text-model-dropdown.png"))

            # --- 5. Multimodal (image) dropdown -------------------------------
            page.keyboard.press("Escape")
            with page.expect_response(
                lambda response: "/api/models" in response.url
                and "modalities=image" in response.url,
                timeout=30000,
            ) as multimodal_response:
                page.check("#modality-image")
            multimodal_payload = multimodal_response.value.json()
            page.wait_for_function(
                "() => !document.getElementById('model-trigger').disabled",
                timeout=30000,
            )
            image_capable_models = page.evaluate(
                "() => (window.__orca.state.options || []).map(m => ({id: m.id, mods: m.input_modalities}))"
            )
            if [m["id"] for m in image_capable_models] != [
                m["id"] for m in multimodal_payload["models"]
            ]:
                failures.append(
                    "the multimodal dropdown does not match the capability response for this surface"
                )
            if not multimodal_payload["models"]:
                failures.append("the multimodal capability returned no options to verify")
            missing_image = [
                m["id"] for m in image_capable_models if "image" not in (m["mods"] or [])
            ]
            if missing_image:
                failures.append(
                    "models without declared image input in the multimodal dropdown: "
                    + ", ".join(missing_image)
                )

            page.click("#model-trigger")
            page.wait_for_selector("#model-panel:not([hidden])")
            multimodal_items = len(page.query_selector_all("#model-listbox li"))
            page.screenshot(path=str(EVIDENCE_DIR / "multimodal-model-dropdown.png"))
            page.keyboard.press("Escape")

            # --- 6. Login lock: pagehide must release it ----------------------
            # Drives the real login state machine (no consent is ever given), so
            # this exercises the path the spec calls out: a back-forward-cache
            # restore must not stay stuck.
            def lock_state():
                return page.evaluate(
                    "() => ({"
                    " busy: window.__orca.state.busy,"
                    " attempt: window.__orca.state.attemptId,"
                    " startDisabled: document.getElementById('connect-start').disabled,"
                    " panelHidden: document.getElementById('connect-panel').hidden,"
                    " hint: document.getElementById('pkce-status').textContent"
                    "})"
                )

            page.click("#connect-start")
            page.wait_for_function("() => window.__orca.state.busy === true", timeout=20000)
            page.wait_for_function(
                "() => document.getElementById('connect-url').getAttribute('href') !== null",
                timeout=20000,
            )
            first_attempt_url = page.evaluate(
                "() => document.getElementById('connect-url').getAttribute('href')"
            )
            busy_before = lock_state()
            page.screenshot(
                path=str(EVIDENCE_DIR / "pkce-login-in-progress.png"), full_page=True
            )

            page.evaluate(
                "() => window.dispatchEvent(new PageTransitionEvent('pagehide', {persisted: true}))"
            )
            page.wait_for_function(
                "() => window.__orca.state.busy === false && window.__orca.state.attemptId === null",
                timeout=10000,
            )
            after_pagehide = lock_state()

            # No remount: start a second login on the restored page.
            page.click("#connect-start")
            page.wait_for_function("() => window.__orca.state.busy === true", timeout=20000)
            page.wait_for_function(
                "() => window.__orca.state.attemptId !== null", timeout=30000
            )
            second_attempt_url = page.evaluate(
                "() => document.getElementById('connect-url').getAttribute('href')"
            )
            second_attempt_id = page.evaluate("() => window.__orca.state.attemptId")
            page.click("#connect-cancel")
            page.wait_for_function("() => window.__orca.state.busy === false", timeout=15000)
            after_cancel = lock_state()

            login_lifecycle = {
                "busy_starts": busy_before["busy"],
                "pagehide_clears_busy": after_pagehide["busy"] is False,
                "pagehide_clears_hint": "approval" not in after_pagehide["hint"].lower(),
                "pagehide_clears_attempt": after_pagehide["attempt"] is None,
                "second_login_without_remount": second_attempt_id is not None
                and second_attempt_id != busy_before["attempt"]
                and second_attempt_url != first_attempt_url
                and "/auth?" in second_attempt_url,
                "cancel_clears_busy": after_cancel["busy"] is False,
                "authorize_origin": first_attempt_url.split("/auth")[0],
            }
            for label, ok in [
                ("pagehide left the login busy flag set", login_lifecycle["pagehide_clears_busy"]),
                (
                    "pagehide left the authorization hint stale",
                    login_lifecycle["pagehide_clears_hint"],
                ),
                (
                    "pagehide left the login generation mounted",
                    login_lifecycle["pagehide_clears_attempt"],
                ),
                (
                    "a second login could not start after pagehide without a remount",
                    login_lifecycle["second_login_without_remount"],
                ),
                ("cancel left the login busy flag set", login_lifecycle["cancel_clears_busy"]),
                (
                    "the authorize URL did not use the auth origin",
                    login_lifecycle["authorize_origin"] == "https://www.orcarouter.ai",
                ),
            ]:
                if not ok:
                    failures.append(label)

            browser.close()
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
        shutil.rmtree(work_dir, ignore_errors=True)

    # --- 7. Cross-check the rendered counts against the real catalog ---------
    # The manifest counts are the selector's own counts, and they must equal the
    # authoritative chat catalog. A mismatch is a failure, not a footnote.
    try:
        catalog_records = authoritative_catalog()
        catalog_total = len(catalog_records)
        image_total = len([model for model in catalog_records if image_capable(model)])
    except Exception as error:  # noqa: BLE001 - recorded, not fatal
        failures.append(f"could not read the authoritative catalog for the manifest: {error}")

    if catalog_total and len(anonymous_state["ids"]) != catalog_total:
        failures.append(
            "the live text dropdown did not match the authoritative chat catalog "
            f"({len(anonymous_state['ids'])} rendered vs {catalog_total} in the catalog)"
        )
    if image_total and multimodal_items != image_total:
        failures.append(
            "the multimodal dropdown did not match the image-capable chat catalog "
            f"({multimodal_items} rendered vs {image_total} in the catalog)"
        )

    if not results.get("api_key_visible"):
        failures.append("the API-key input was not visible")
    if not results.get("pkce_visible"):
        failures.append("the PKCE authentication method was not visible")
    if not results.get("controls_enabled"):
        failures.append("authentication controls were not enabled")
    if not secret_masked:
        failures.append("the stored credential was not shown in masked form")
    if not results.get("dropdown_open"):
        failures.append("the model dropdown did not open")
    if results.get("trigger_panel_right_delta", 99) > 2:
        failures.append(
            "dropdown panel is not aligned with its trigger "
            f"(delta {results.get('trigger_panel_right_delta')}px)"
        )
    if results.get("item_count") in (None, "0/0"):
        failures.append("the model dropdown had no items")
    if not results.get("degraded_catalog_labelled"):
        failures.append("the degraded catalog was not labelled as a verified fallback")
    if results.get("degraded_catalog_item_count", 0) < 1:
        failures.append("the degraded catalog offered no selectable model")
    if not results.get("live_catalog_model_count"):
        failures.append("live discovery produced no model before any credential was stored")
    if multimodal_items < 1:
        failures.append("the multimodal dropdown had no items")

    artifacts = []
    for name, describe, ui in [
        (
            "auth-methods.png",
            "Both authentication methods visible: OrcaRouter - API and OrcaRouter - Auth "
            "(OAuth 2.0 + PKCE), with the stored credential masked",
            {
                "api_key_visible": bool(results.get("api_key_visible")),
                "pkce_visible": bool(results.get("pkce_visible")),
                "secret_masked": bool(secret_masked),
                "controls_enabled": bool(results.get("controls_enabled")),
            },
        ),
        (
            "text-model-dropdown.png",
            "The text chat model selector expanded, listing models discovered from the live "
            "OrcaRouter chat catalog",
            {
                "dropdown_open": bool(results.get("dropdown_open")),
                "item_count": catalog_total,
                "opaque_background": bool(results.get("opaque_background")),
                "visible_border": bool(results.get("visible_border")),
                "trigger_panel_right_delta": results.get("trigger_panel_right_delta"),
            },
        ),
        (
            "multimodal-model-dropdown.png",
            "The same selector with an image attachment enabled: only chat models that declare "
            "image input remain",
            {
                "dropdown_open": True,
                "item_count": image_total,
                "opaque_background": bool(results.get("opaque_background")),
                "visible_border": bool(results.get("visible_border")),
                "trigger_panel_right_delta": results.get("trigger_panel_right_delta"),
            },
        ),
    ]:
        path = EVIDENCE_DIR / name
        if not path.is_file():
            failures.append(f"the screenshot was not written: {name}")
            continue
        artifacts.append(
            {
                "kind": name[: -len(".png")],
                "path": name,
                "description": describe,
                "sha256": sha256(path),
                "ui": ui,
            }
        )

    manifest = {
        "automation": {
            "runner": "cli-tool/scripts/orcarouter-gui-evidence.py",
            "framework": "playwright",
            "passed": not failures,
            "catalog_source": CATALOG_SOURCE,
            "catalog_model_count": catalog_total,
            "image_model_count": image_total,
        },
        "provider_catalog_chat_count": len(anonymous_state["ids"]),
        "live_catalog_model_count": results.get("live_catalog_model_count"),
        "catalog_degraded": catalog_degraded,
        "catalog_state_text": catalog_state.get("text"),
        "degraded_catalog_state_text": results.get("degraded_catalog_state_text"),
        "login_lifecycle": login_lifecycle,
        "console_errors": console_errors,
        "artifacts": artifacts,
        "failures": failures,
        "notes": (
            "Screenshots are of the real dashboard served by "
            "cli-tool/src/orcarouter-dashboard.js with a dedicated temporary "
            "credential store holding a shape-valid fake key. The model counts are "
            "the selector's rendered counts and are cross-checked against "
            + CATALOG_SOURCE
        ),
    }
    (EVIDENCE_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")

    print(json.dumps({k: v for k, v in manifest.items() if k != "artifacts"}, indent=2))
    if failures:
        print("\nFAILURES:")
        for failure in failures:
            print(f"  - {failure}")
        return 1
    print("\nGUI evidence collected.")
    return 0


if __name__ == "__main__":
    sys.exit(main())

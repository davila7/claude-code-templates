from __future__ import annotations

import importlib.util
import io
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

SCRIPT = Path(__file__).parents[1] / "scripts" / "atlas_text_to_speech.py"
SPEC = importlib.util.spec_from_file_location("atlas_tts", SCRIPT)
assert SPEC and SPEC.loader
atlas_tts = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(atlas_tts)


class _Response:
    def __init__(self, body: bytes):
        self._body = body

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self, _size=-1):
        return self._body


class AtlasTextToSpeechTests(unittest.TestCase):
    def test_dry_run_does_not_require_key(self):
        stdout = io.StringIO()
        with (
            mock.patch.dict("os.environ", {}, clear=True),
            mock.patch("sys.stdout", stdout),
        ):
            result = atlas_tts.main(["speak", "--input", "Hello", "--dry-run"])
        self.assertEqual(result, 0)
        self.assertIn('"model": "xai/tts-v1"', stdout.getvalue())
        self.assertNotIn("Bearer", stdout.getvalue())

    def test_submission_post_is_not_retried(self):
        calls = 0

        def fail(_request, timeout):
            nonlocal calls
            calls += 1
            raise urllib.error.URLError("offline")

        with mock.patch.object(atlas_tts.urllib.request, "urlopen", side_effect=fail):
            with self.assertRaises(urllib.error.URLError):
                atlas_tts._submit({"model": "xai/tts-v1"}, "key")
        self.assertEqual(calls, 1)

    def test_requests_use_explicit_user_agent(self):
        seen = []

        def respond(request, timeout):
            seen.append(request)
            return _Response(b'{"code":200,"data":{"id":"pred-1"}}')

        with mock.patch.object(
            atlas_tts.urllib.request, "urlopen", side_effect=respond
        ):
            self.assertEqual(
                atlas_tts._submit({"model": "xai/tts-v1"}, "key"), "pred-1"
            )
        self.assertEqual(seen[0].get_header("User-agent"), atlas_tts.USER_AGENT)

    def test_http_error_is_sanitized_and_not_retried(self):
        calls = 0

        def fail(request, timeout):
            nonlocal calls
            calls += 1
            raise urllib.error.HTTPError(request.full_url, 403, "Forbidden", {}, None)

        with mock.patch.object(atlas_tts.urllib.request, "urlopen", side_effect=fail):
            with self.assertRaisesRegex(
                RuntimeError, "Atlas API returned HTTP 403: Forbidden"
            ):
                atlas_tts._submit({"model": "xai/tts-v1"}, "secret-key")
        self.assertEqual(calls, 1)

    def test_poll_retries_get_and_returns_output(self):
        responses = [
            urllib.error.URLError("temporary"),
            _Response(b'{"code":200,"data":{"status":"processing"}}'),
            _Response(
                b'{"code":200,"data":{"status":"completed","outputs":["https://cdn.example/audio.mp3"]}}'
            ),
        ]
        with (
            mock.patch.object(
                atlas_tts.urllib.request, "urlopen", side_effect=responses
            ),
            mock.patch.object(atlas_tts.time, "sleep"),
        ):
            output = atlas_tts._poll("pred-1", "key", attempts=2, interval=0)
        self.assertEqual(output, "https://cdn.example/audio.mp3")

    def test_poll_retries_transient_http_error(self):
        error = urllib.error.HTTPError(
            f"{atlas_tts.API_BASE}/model/prediction/pred-1",
            503,
            "Unavailable",
            {},
            None,
        )
        responses = [
            error,
            _Response(
                b'{"code":200,"data":{"status":"completed","outputs":["https://cdn.example/audio.mp3"]}}'
            ),
        ]
        with (
            mock.patch.object(
                atlas_tts.urllib.request, "urlopen", side_effect=responses
            ),
            mock.patch.object(atlas_tts.time, "sleep"),
        ):
            output = atlas_tts._poll("pred-1", "key", attempts=1, interval=0)
        self.assertEqual(output, "https://cdn.example/audio.mp3")

    def test_private_literal_download_is_rejected(self):
        with self.assertRaises(SystemExit):
            atlas_tts._validate_download_url("https://127.0.0.1/audio.mp3")

    def test_named_private_host_is_rejected(self):
        with mock.patch.object(
            atlas_tts.socket,
            "getaddrinfo",
            return_value=[(None, None, None, None, ("10.0.0.8", 443))],
        ):
            with self.assertRaises(SystemExit):
                atlas_tts._validate_download_url("https://cdn.example/audio.mp3")

    def test_tun_fake_ip_is_allowed_for_named_host_only(self):
        with mock.patch.object(
            atlas_tts.socket,
            "getaddrinfo",
            return_value=[(None, None, None, None, ("198.18.0.10", 443))],
        ):
            atlas_tts._validate_download_url("https://cdn.example/audio.mp3")
        with self.assertRaises(SystemExit):
            atlas_tts._validate_download_url("https://198.18.0.10/audio.mp3")

    def test_existing_output_stops_before_submission(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "speech.mp3"
            output.write_bytes(b"existing")
            args = mock.Mock(force=False, dry_run=False)
            with (
                mock.patch.object(atlas_tts, "_api_key") as api_key,
                self.assertRaises(SystemExit),
            ):
                atlas_tts._generate({"model": "xai/tts-v1"}, output, args)
        api_key.assert_not_called()

    def test_batch_dry_run_uses_job_overrides(self):
        with tempfile.TemporaryDirectory() as directory:
            jobs = Path(directory) / "jobs.jsonl"
            jobs.write_text(
                '{"input":"Ni hao","language":"zh","voice":"leo","codec":"wav"}\n',
                encoding="utf-8",
            )
            stdout = io.StringIO()
            with (
                mock.patch.dict("os.environ", {}, clear=True),
                mock.patch("sys.stdout", stdout),
            ):
                result = atlas_tts.main(
                    [
                        "speak-batch",
                        "--input",
                        str(jobs),
                        "--out-dir",
                        directory,
                        "--dry-run",
                    ]
                )
        self.assertEqual(result, 0)
        output = stdout.getvalue()
        self.assertIn('"language": "zh"', output)
        self.assertIn('"voice_id": "leo"', output)
        self.assertIn("001-speech.wav", output)


if __name__ == "__main__":
    unittest.main()

from __future__ import annotations

import importlib.util
import io
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest import mock


SCRIPT = Path(__file__).parents[1] / "scripts" / "muapi-text-to-speech.py"
SPEC = importlib.util.spec_from_file_location("muapi_tts", SCRIPT)
assert SPEC and SPEC.loader
muapi_tts = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(muapi_tts)


class _Response:
    def __init__(self, body: bytes, headers=None):
        self._body = body
        self.headers = headers or {}

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self, _size=-1):
        body, self._body = self._body, b""
        return body


class MuapiTextToSpeechTests(unittest.TestCase):
    def test_dry_run_does_not_require_key(self):
        stdout = io.StringIO()
        with (
            mock.patch.dict("os.environ", {}, clear=True),
            mock.patch("sys.stdout", stdout),
        ):
            result = muapi_tts.main(
                ["speak", "--input", "Hello", "--language-code", "en", "--dry-run"]
            )
        self.assertEqual(result, 0)
        output = stdout.getvalue()
        self.assertIn('"model": "elevenlabs-tts-turbo-2-5"', output)
        self.assertIn('"prompt": "Hello"', output)
        self.assertNotIn("x-api-key", output)

    def test_submission_post_is_not_retried(self):
        calls = 0

        def fail(_request):
            nonlocal calls
            calls += 1
            raise urllib.error.URLError("offline")

        with mock.patch.object(muapi_tts, "_open_api", side_effect=fail):
            with self.assertRaises(RuntimeError):
                muapi_tts._submit({"prompt": "Hello"}, "key")
        self.assertEqual(calls, 1)

    def test_generation_uses_muapi_header_without_bearer(self):
        seen = []

        def respond(request):
            seen.append(request)
            return _Response(b'{"request_id":"pred-1"}')

        with mock.patch.object(muapi_tts, "_open_api", side_effect=respond):
            self.assertEqual(
                muapi_tts._submit({"prompt": "Hello"}, "secret"), "pred-1"
            )
        self.assertEqual(seen[0].get_header("X-api-key"), "secret")
        self.assertIsNone(seen[0].get_header("Authorization"))

    def test_poll_retries_get_and_returns_audio_url(self):
        responses = [
            urllib.error.URLError("temporary"),
            _Response(b'{"status":"completed","output":{"audio_url":"https://cdn.example/audio.mp3"}}'),
        ]
        with (
            mock.patch.object(muapi_tts, "_open_api", side_effect=responses),
            mock.patch.object(muapi_tts.time, "sleep"),
        ):
            output = muapi_tts._poll(
                "pred-1", "key", attempts=1, interval=0
            )
        self.assertEqual(output, "https://cdn.example/audio.mp3")

    def test_poll_fails_without_extra_polls_after_terminal_status(self):
        with mock.patch.object(
            muapi_tts,
            "_open_api",
            return_value=_Response(b'{"status":"failed"}'),
        ) as urlopen:
            with self.assertRaisesRegex(RuntimeError, "failed"):
                muapi_tts._poll("pred-1", "key", attempts=4, interval=0)
        self.assertEqual(urlopen.call_count, 1)

    def test_invalid_non_finite_speed_is_rejected(self):
        with self.assertRaises(SystemExit):
            muapi_tts._number(float("nan"), 0.7, 1.2, "speed")

    def test_invalid_voice_is_rejected(self):
        args = mock.Mock(
            voice_id="not-a-voice",
            stability=0.5,
            similarity_boost=0.75,
            speed=1.0,
            language_code=None,
        )
        with self.assertRaises(SystemExit):
            muapi_tts._payload(args, "Hello")

    def test_private_literal_download_is_rejected(self):
        with self.assertRaises(SystemExit):
            muapi_tts._validate_download_url("https://127.0.0.1/audio.mp3")

    def test_named_private_download_host_is_rejected(self):
        with mock.patch.object(
            muapi_tts.socket,
            "getaddrinfo",
            return_value=[(None, None, None, None, ("10.0.0.8", 443))],
        ):
            with self.assertRaises(SystemExit):
                muapi_tts._validate_download_url("https://cdn.example/audio.mp3")

    def test_api_redirect_outside_fixed_origin_is_rejected(self):
        handler = muapi_tts._FixedOriginRedirectHandler()
        request = muapi_tts.urllib.request.Request(
            "https://api.muapi.ai/api/v1/models/example",
            headers={"x-api-key": "secret"},
        )
        with self.assertRaisesRegex(RuntimeError, "fixed API origin"):
            handler.redirect_request(
                request,
                io.BytesIO(),
                307,
                "Temporary Redirect",
                {},
                "https://attacker.example/collect",
            )

    def test_download_rechecks_dns_before_connection(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "speech.mp3"
            with mock.patch.object(
                muapi_tts.socket,
                "getaddrinfo",
                side_effect=[
                    [(muapi_tts.socket.AF_INET, muapi_tts.socket.SOCK_STREAM, 6, "", ("8.8.8.8", 443))],
                    [(muapi_tts.socket.AF_INET, muapi_tts.socket.SOCK_STREAM, 6, "", ("10.0.0.8", 443))],
                ],
            ):
                with self.assertRaises(urllib.error.URLError):
                    muapi_tts._download(
                        "https://cdn.example/audio.mp3", output, force=True
                    )

    def test_batch_discovers_model_once(self):
        with tempfile.TemporaryDirectory() as directory:
            jobs = Path(directory) / "jobs.jsonl"
            jobs.write_text(
                '{"input":"One"}\n{"input":"Two"}\n',
                encoding="utf-8",
            )
            with (
                mock.patch.dict("os.environ", {"MUAPI_API_KEY": "secret"}, clear=True),
                mock.patch.object(muapi_tts, "_discover_model", return_value={}) as discover,
                mock.patch.object(muapi_tts, "_submit", side_effect=["pred-1", "pred-2"]),
                mock.patch.object(
                    muapi_tts,
                    "_poll",
                    side_effect=["https://cdn.example/one.mp3", "https://cdn.example/two.mp3"],
                ),
                mock.patch.object(muapi_tts, "_download"),
            ):
                result = muapi_tts.main(
                    [
                        "speak-batch",
                        "--input",
                        str(jobs),
                        "--out-dir",
                        directory,
                        "--poll-attempts",
                        "1",
                        "--poll-interval",
                        "0",
                    ]
                )
        self.assertEqual(result, 0)
        discover.assert_called_once_with()

    def test_batch_existing_output_stops_before_discovery(self):
        with tempfile.TemporaryDirectory() as directory:
            jobs = Path(directory) / "jobs.jsonl"
            jobs.write_text('{"input":"One"}\n', encoding="utf-8")
            (Path(directory) / "001-speech.mp3").write_bytes(b"existing")
            with mock.patch.object(muapi_tts, "_discover_model") as discover:
                with self.assertRaises(SystemExit):
                    muapi_tts.main(
                        [
                            "speak-batch",
                            "--input",
                            str(jobs),
                            "--out-dir",
                            directory,
                        ]
                    )
        discover.assert_not_called()

    def test_batch_dry_run_uses_job_overrides(self):
        with tempfile.TemporaryDirectory() as directory:
            jobs = Path(directory) / "jobs.jsonl"
            jobs.write_text(
                '{"input":"Bonjour","language_code":"fr","speed":0.9}\n',
                encoding="utf-8",
            )
            stdout = io.StringIO()
            with (
                mock.patch.dict("os.environ", {}, clear=True),
                mock.patch("sys.stdout", stdout),
            ):
                result = muapi_tts.main(
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
        self.assertIn('"language_code": "fr"', output)
        self.assertIn('"speed": 0.9', output)
        self.assertIn("001-speech.mp3", output)


if __name__ == "__main__":
    unittest.main()

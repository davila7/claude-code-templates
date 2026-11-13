from __future__ import annotations

import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

SCRIPT = Path(__file__).parents[1] / "scripts" / "text_to_speech.py"
SPEC = importlib.util.spec_from_file_location("openai_tts", SCRIPT)
assert SPEC and SPEC.loader
openai_tts = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(openai_tts)

OTHER_SERVER = {"OPENAI_BASE_URL": "http://localhost:8880/v1"}


def _run(argv: list[str], env: dict[str, str]) -> tuple[int, str, str]:
    stdout, stderr = io.StringIO(), io.StringIO()
    with (
        mock.patch.dict("os.environ", env, clear=True),
        mock.patch("sys.stdout", stdout),
        mock.patch("sys.stderr", stderr),
    ):
        try:
            result = openai_tts.main(argv)
        except SystemExit as exc:
            result = exc.code
    return result, stdout.getvalue(), stderr.getvalue()


def _payloads(stdout: str) -> list[dict]:
    decoder = json.JSONDecoder()
    payloads, index = [], stdout.find("{")
    while index != -1:
        payload, end = decoder.raw_decode(stdout, index)
        payloads.append(payload)
        index = stdout.find("{", end)
    return payloads


def _batch(env: dict[str, str], jobs: list[dict], *flags: str) -> tuple[int, str, str]:
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "jobs.jsonl"
        path.write_text(
            "".join(json.dumps(job) + "\n" for job in jobs), encoding="utf-8"
        )
        return _run(
            [
                "speak-batch",
                "--input",
                str(path),
                "--out-dir",
                tmp,
                "--dry-run",
                *flags,
            ],
            env,
        )


class TextToSpeechTests(unittest.TestCase):
    def speak(self, env: dict[str, str], *flags: str) -> dict:
        result, stdout, _ = _run(
            ["speak", "--input", "Hello", "--dry-run", *flags], env
        )
        self.assertEqual(result, 0)
        return _payloads(stdout)[0]

    def batch(self, env: dict[str, str], jobs: list[dict], *flags: str) -> list[str]:
        result, stdout, _ = _batch(env, jobs, *flags)
        self.assertEqual(result, 0)
        return [payload["voice"] for payload in _payloads(stdout)]

    def test_defaults_without_environment(self):
        payload = self.speak({})
        self.assertEqual(payload["model"], "gpt-4o-mini-tts-2025-12-15")
        self.assertEqual(payload["voice"], "cedar")

    def test_environment_sets_default_model_and_voice(self):
        payload = self.speak(
            {"OPENAI_TTS_MODEL": "tts-1-hd", "OPENAI_TTS_VOICE": "Marin"}
        )
        self.assertEqual(payload["model"], "tts-1-hd")
        self.assertEqual(payload["voice"], "marin")

    def test_flags_override_environment(self):
        env = {"OPENAI_TTS_MODEL": "tts-1-hd", "OPENAI_TTS_VOICE": "marin"}
        payload = self.speak(env, "--model", "tts-1", "--voice", "ash")
        self.assertEqual(payload["model"], "tts-1")
        self.assertEqual(payload["voice"], "ash")

    def test_blank_values_fall_back_to_the_defaults(self):
        payload = self.speak({"OPENAI_TTS_MODEL": " ", "OPENAI_TTS_VOICE": " "})
        self.assertEqual(payload["model"], "gpt-4o-mini-tts-2025-12-15")
        self.assertEqual(payload["voice"], "cedar")
        self.assertEqual(
            self.speak({"OPENAI_TTS_VOICE": "Marin"}, "--voice", " ")["voice"], "marin"
        )

    def test_other_server_accepts_its_own_voice_ids(self):
        payload = self.speak(
            {**OTHER_SERVER, "OPENAI_TTS_MODEL": "local-tts"}, "--voice", "af_Bella"
        )
        self.assertEqual(payload["model"], "local-tts")
        self.assertEqual(payload["voice"], "af_Bella")

    def test_other_server_still_lowercases_openai_voice_names(self):
        self.assertEqual(self.speak(OTHER_SERVER, "--voice", "Cedar")["voice"], "cedar")

    def test_openai_hosts_keep_the_voice_list(self):
        for host in ("", "openai.com", "api.openai.com", "eu.api.openai.com"):
            base_url = f"https://{host}/v1" if host else ""
            with self.subTest(host=host):
                result, _, stderr = _run(
                    ["speak", "--input", "Hello", "--dry-run", "--voice", "af_bella"],
                    {"OPENAI_BASE_URL": base_url},
                )
                self.assertEqual(result, 1)
                self.assertIn("'af_bella' must be one of", stderr)

    def test_lookalike_hosts_are_other_servers(self):
        for host in ("evilopenai.com", "api.openai.com.example.test"):
            with self.subTest(host=host):
                payload = self.speak(
                    {"OPENAI_BASE_URL": f"https://{host}/v1"}, "--voice", "af_bella"
                )
                self.assertEqual(payload["voice"], "af_bella")

    def test_malformed_base_url_counts_as_another_server(self):
        payload = self.speak({"OPENAI_BASE_URL": "http://[::1"}, "--voice", "af_bella")
        self.assertEqual(payload["voice"], "af_bella")

    def test_rejected_voice_names_the_value_and_its_source(self):
        result, _, stderr = _run(
            ["speak", "--input", "Hello", "--dry-run"], {"OPENAI_TTS_VOICE": "af_bella"}
        )
        self.assertEqual(result, 1)
        self.assertIn("'af_bella' (from OPENAI_TTS_VOICE)", stderr)

    def test_batch_jobs_use_the_server_voice_and_default(self):
        env = {**OTHER_SERVER, "OPENAI_TTS_VOICE": "narrator"}
        voices = self.batch(
            env, [{"input": "One", "voice": "Guide_2"}, {"input": "Two"}]
        )
        self.assertEqual(voices, ["Guide_2", "narrator"])

    def test_blank_job_voice_inherits_the_batch_voice(self):
        env = {**OTHER_SERVER, "OPENAI_TTS_VOICE": "narrator"}
        jobs = [
            {"input": "One", "voice": " "},
            {"input": "Two", "voice": None},
            {"input": "Three"},
        ]
        self.assertEqual(self.batch(env, jobs, "--voice", "Guide_9"), ["Guide_9"] * 3)

    def test_batch_checks_job_voices_on_openai(self):
        self.assertEqual(
            self.batch({}, [{"input": "One", "voice": "Cedar"}]), ["cedar"]
        )
        result, _, _ = _batch({}, [{"input": "One", "voice": "af_bella"}])
        self.assertEqual(result, 1)

    def test_unused_batch_voice_is_not_checked(self):
        env = {"OPENAI_TTS_VOICE": "af_bella"}
        jobs = [{"input": "One", "voice": "cedar"}, {"input": "Two", "voice": "Marin"}]
        self.assertEqual(self.batch(env, jobs), ["cedar", "marin"])
        result, _, stderr = _batch(env, [*jobs, {"input": "Three"}])
        self.assertEqual(result, 1)
        self.assertIn("'af_bella' (from OPENAI_TTS_VOICE)", stderr)

    def test_non_string_job_voice_is_checked_not_inherited(self):
        for voice in (0, False):
            with self.subTest(voice=voice):
                result, _, stderr = _batch({}, [{"input": "One", "voice": voice}])
                self.assertEqual(result, 1)
                self.assertIn(f"{str(voice)!r} must be one of", stderr)

    def test_list_voices_warns_only_when_another_server_is_set(self):
        result, stdout, stderr = _run(["list-voices"], OTHER_SERVER)
        self.assertEqual(result, 0)
        self.assertIn("cedar", stdout.split())
        self.assertIn("OPENAI_BASE_URL", stderr)
        self.assertEqual(_run(["list-voices"], {})[2], "")


if __name__ == "__main__":
    unittest.main()

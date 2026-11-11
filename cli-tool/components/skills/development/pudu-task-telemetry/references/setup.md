# Setup and diagnosis

The skill's scripts have no npm dependencies or build step. Use Node.js >=20.
Install Pudu AI and Ollama separately using their published instructions, within
the user's authorized setup scope. Do not install them as part of diagnosis.

Pudu is invoked through its executable, never through private library exports:

```bash
pudu-ai hardware --json --no-network --no-color
pudu-ai models --json --no-network --no-color
```

`--no-network` disables Pudu's catalog network use, not the operating system's
network. Pudu may initialize its own local storage. This skill does not call
`repo harness`, `launch`, `pull`, `setup`, or package installers. `doctor`
separates Ollama-installed models from other local inventory rows; catalog URLs
and artifact paths are not copied into telemetry.

## Configuration

Pass a JSON file with `--config`. Relative filenames are resolved from `--repo`.
Paths in configuration are user supplied; do not commit personal paths.

```json
{
  "pudu": {"command": "pudu-ai", "args": [], "timeoutMs": 30000},
  "ollama": {"baseUrl": "http://127.0.0.1:11434", "localOnlyConfirmed": false}
}
```

For an existing source checkout, `command` may be `node` and `args` the path to
its built CLI. No shell interpolation occurs. Pudu's version is discovered from
installed package metadata where possible; otherwise it is null. A source
checkout invoked through `node` may therefore have an unavailable Pudu version.

Before setting `localOnlyConfirmed` to true, verify that the **server** runs with
`OLLAMA_NO_CLOUD=1` or equivalent `disable_ollama_cloud` configuration, and that
the chosen model is locally installed. Follow the
[official server configuration instructions](https://docs.ollama.com/faq).
Changing the client's environment does not configure an already running server.
The confirmation is an operator assertion, not a remotely verified attestation.
The runner additionally rejects non-loopback origins, redirects, remote model
metadata and unknown model provenance. Metadata probes do not perform inference.

For a separate test server, select an unused loopback port, start `ollama serve`
with `OLLAMA_HOST` set to that address and `OLLAMA_NO_CLOUD=1`, and point the test
configuration at it. Reuse existing model files; do not download models or stop
the user's shared daemon. Network isolation, when required, must be enforced by
the environment in addition to these application checks.

## Missing dependencies

`doctor` reports errors using stable JSON codes. An installed GGUF in another
runtime is not automatically served by Ollama. Start or configure dependencies
explicitly, then retry diagnosis. Do not replace unavailable measurements with
estimates or zeros.

The catalog installer copies all files recursively. Before this contribution is
merged, copy its folder to a temporary project's `.claude/skills/` to test it.
The public installer fetches from upstream main and cannot install an unpublished
local branch merely because the installer itself runs from a local checkout.

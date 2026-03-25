# Installation

> Install FastMCP and verify your setup

## Install FastMCP

We recommend using [uv](https://docs.astral.sh/uv/getting-started/installation/) to install and manage FastMCP.

> **Note:** FastMCP 3.0 is currently a release candidate. Package managers won't install pre-release versions by default—you must explicitly request one (e.g., `>=3.0.0rc1`).


```bash
pip install "fastmcp>=3.0.0rc1"
```

Or with uv:

```bash
uv add "fastmcp>=3.0.0rc1"
```

### Optional Dependencies

FastMCP provides optional extras for specific features. For example, to install the background tasks extra:

```bash
pip install "fastmcp[tasks]==3.0.0rc1"
```

See Background Tasks for details on the task system.

### Verify Installation

To verify that FastMCP is installed correctly, you can run the following command:

```bash
fastmcp version
```

You should see output like the following:

```bash
$ fastmcp version

FastMCP version:                        3.0.0rc1
MCP version:                               1.25.0
Python version:                            3.12.2
Platform:            macOS-15.3.1-arm64-arm-64bit
FastMCP root path:            ~/Developer/fastmcp
```

### Dependency Licensing

> **Info:** FastMCP depends on Cyclopts for CLI functionality. Cyclopts v4 includes docutils as a transitive dependency, which has complex licensing that may trigger compliance reviews in some organizations.

  If this is a concern, you can install Cyclopts v5 alpha which removes this dependency:

  ```bash
  pip install "cyclopts>=5.0.0a1"
  ```

  Alternatively, wait for the stable v5 release. See [this issue](https://github.com/BrianPugh/cyclopts/issues/672) for details.


## Upgrading

### From FastMCP 2.x

See the Upgrade Guide for a complete list of breaking changes and migration steps.

### From the Official MCP SDK

Upgrading from the official MCP SDK's FastMCP 1.0 to FastMCP 3.0 is generally straightforward. The core server API is highly compatible, and in many cases, changing your import statement from `from mcp.server.fastmcp import FastMCP` to `from fastmcp import FastMCP` will be sufficient.

```python}
# Before
# from mcp.server.fastmcp import FastMCP

# After
from fastmcp import FastMCP

mcp = FastMCP("My MCP Server")
```

> **Warning:** Prior to `fastmcp==2.3.0` and `mcp==1.8.0`, the 2.x API always mirrored the official 1.0 API. However, as the projects diverge, this can not be guaranteed. You may see deprecation warnings if you attempt to use 1.0 APIs in FastMCP 3.x. Please refer to this documentation for details on new capabilities.


## Versioning Policy

FastMCP follows semantic versioning with pragmatic adaptations for the rapidly evolving MCP ecosystem. Breaking changes may occur in minor versions (e.g., 2.3.x to 2.4.0) when necessary to stay current with the MCP Protocol.

For production use, always pin to exact versions:

```
fastmcp==3.0.0  # Good
fastmcp>=3.0.0  # Bad - may install breaking changes
```

See the full versioning and release policy for details on our public API, deprecation practices, and breaking change philosophy.

### Looking Ahead: FastMCP 4.0

The MCP Python SDK v2 is expected in early 2026 and will include breaking changes. When released, FastMCP will incorporate these upstream changes in a new major version (FastMCP 4.0).

To avoid unexpected breaking changes, we recommend pinning your dependency with an upper bound:

```
fastmcp>=3.0,<4
```

We'll provide migration guidance when FastMCP 4.0 is released.

## Contributing to FastMCP

Interested in contributing to FastMCP? See the Contributing Guide for details on:

* Setting up your development environment
* Running tests and pre-commit hooks
* Submitting issues and pull requests
* Code standards and review process

> ## Documentation Index
> Fetch the complete documentation index at: https://gofastmcp.com/llms.txt
> Use this file to discover all available pages before exploring further.

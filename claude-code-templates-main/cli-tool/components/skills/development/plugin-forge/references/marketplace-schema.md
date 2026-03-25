# Marketplace Schema Reference

## Marketplace Structure

A marketplace is a JSON catalog enabling plugin discovery and distribution.

**File location:** `.claude-plugin/marketplace.json`

## Required Fields

```json
{
  "name": "marketplace-identifier",
  "owner": {
    "name": "Maintainer Name",
    "email": "maintainer@example.com"
  },
  "plugins": []
}
```

**name**: Kebab-case marketplace identifier
**owner**: Maintainer contact information
**plugins**: Array of plugin entries

## Optional Marketplace Fields

**description**: Marketplace overview text
**version**: Release version
**pluginRoot**: Base path for relative plugin sources

## Plugin Entry Schema

Each plugin entry in the `plugins` array:

**Required:**

- `name`: Plugin identifier (kebab-case, must match plugin.json)
- `source`: Plugin origin specification

**Optional:**

- `description`: Plugin purpose
- `version`: Plugin version (semantic versioning)
- `author`: Creator information
- `homepage`: URL
- `repository`: URL
- `license`: SPDX identifier
- `keywords`: Array of search terms
- `category`: Classification (e.g., "framework", "productivity")
- `tags`: Additional discovery tags
- `commands`: Path to commands directory
- `agents`: Path to agents directory
- `hooks`: Path to hooks configuration
- `mcpServers`: Path to MCP configuration

## Source Specifications

### Relative Path Source

```json
{
  "name": "my-plugin",
  "source": "./plugins/my-plugin"
}
```

### GitHub Source

```json
{
  "name": "my-plugin",
  "source": {
    "source": "github",
    "repo": "owner/repo"
  }
}
```

### Generic Git Source

```json
{
  "name": "my-plugin",
  "source": {
    "source": "url",
    "url": "https://git.example.com/plugin.git"
  }
}
```

## Complete Example

```json
{
  "name": "example-marketplace",
  "description": "Example plugin marketplace",
  "version": "1.0.0",
  "owner": {
    "name": "Marketplace Owner",
    "email": "owner@example.com"
  },
  "pluginRoot": "./plugins",
  "plugins": [
    {
      "name": "example-plugin",
      "source": "./example-plugin",
      "description": "Example plugin",
      "version": "1.0.0",
      "keywords": ["example"],
      "category": "productivity"
    }
  ]
}
```

## Team Distribution

Configure automatic marketplace availability via `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": [
    {
      "source": {
        "source": "github",
        "repo": "company/marketplace"
      }
    }
  ]
}
```

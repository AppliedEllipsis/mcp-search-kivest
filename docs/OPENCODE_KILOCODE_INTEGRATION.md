# OpenCode & Kilocode Integration Guide

This guide explains how to integrate the Kivest MCP Search server with OpenCode and Kilocode AI coding assistants.

## Quick Start (Local Development)

The recommended approach is to run the local build directly - no npm publishing or API key needed.

### Step 1: Build the Project

```bash
cd mcp-search-kivest
npm install
npm run build
```

### Step 2: Get the Absolute Path

```bash
# macOS/Linux
pwd
# Output: /home/user/projects/mcp-search-kivest

# Windows
cd
echo %CD%
# Output: D:\projects\mcp-search-kivest
```

### Step 3: Configure Your AI Assistant

Use the absolute path to `dist/index.js` in your configuration.

---

## OpenCode Integration

### Configuration File

Create `opencode.json` in your project root:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "kivest-search": {
      "type": "local",
      "command": ["node", "/absolute/path/to/mcp-search-kivest/dist/index.js"],
      "enabled": true
    }
  }
}
```

### Configuration File Locations

OpenCode loads configuration from multiple locations in priority order:

| Priority | Location | Use Case |
|----------|----------|----------|
| 1 | Remote config (.well-known/opencode) | Organization defaults |
| 2 | Global config (~/.config/opencode/opencode.json) | User preferences |
| 3 | Custom config (OPENCODE_CONFIG env) | Custom path |
| 4 | **Project config (opencode.json in project root)** | **Project-specific settings** |
| 5 | .opencode/ directory | Agents, commands, plugins |
| 6 | Inline config (OPENCODE_CONFIG_CONTENT env) | Runtime overrides |

### Example: macOS/Linux

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "kivest-search": {
      "type": "local",
      "command": ["node", "/home/username/projects/mcp-search-kivest/dist/index.js"],
      "enabled": true
    }
  }
}
```

### Example: Windows

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "kivest-search": {
      "type": "local",
      "command": ["node", "D:\\projects\\mcp-search-kivest\\dist/index.js"],
      "enabled": true
    }
  }
}
```

---

## Kilocode Integration

### Configuration Files

**For Kilocode CLI:**

| Scope | Path | Notes |
|-------|------|-------|
| Global | ~/.config/kilo/kilo.json | Also supports kilo.jsonc |
| Project | ./kilo.json or ./.kilo/kilo.json | Project-specific settings |

**For Kilocode VS Code Extension:**

| Scope | Path |
|-------|------|
| Global | mcp_settings.json (via VS Code settings) |
| Project | .kilocode/mcp.json |

### Kilocode CLI Configuration

Create `kilo.json` in your project root:

```json
{
  "mcp": {
    "kivest-search": {
      "type": "local",
      "command": ["node", "/absolute/path/to/mcp-search-kivest/dist/index.js"],
      "enabled": true,
      "timeout": 60000
    }
  }
}
```

### Kilocode VS Code Extension

Create `.kilocode/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "kivest-search": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-search-kivest/dist/index.js"],
      "disabled": false
    }
  }
}
```

### Example: macOS/Linux

**kilo.json:**
```json
{
  "mcp": {
    "kivest-search": {
      "type": "local",
      "command": ["node", "/home/username/projects/mcp-search-kivest/dist/index.js"],
      "enabled": true,
      "timeout": 60000
    }
  }
}
```

### Example: Windows

**kilo.json:**
```json
{
  "mcp": {
    "kivest-search": {
      "type": "local",
      "command": ["node", "D:\\projects\\mcp-search-kivest\\dist/index.js"],
      "enabled": true,
      "timeout": 60000
    }
  }
}
```

---

## Development Workflow

### Making Changes

When you modify the source code:

```bash
# Rebuild after changes
npm run build

# Your AI assistant will automatically pick up the new build
```

### No npm Registry Needed

Running locally means:
- No publishing to npm required
- No waiting for package updates
- Immediate feedback on code changes
- Works offline

---

## Troubleshooting

### Common Issues

**"Cannot find module" errors**
- Make sure you ran `npm install`
- Verify `npm run build` completed successfully
- Check that `dist/index.js` exists

**"ENOENT: no such file or directory"**
- The path in your config is incorrect
- Use absolute paths, not relative paths
- On Windows: use double backslashes `\\` or forward slashes `/`

**OpenCode: "MCP server not showing"**
- Verify `opencode.json` is in project root
- Check JSON syntax is valid
- Restart OpenCode completely
- Look for config loading messages in output

**Kilocode: "MCP server connection failed"**
```bash
# List configured servers
kilo mcp list

# Test the server manually
node /path/to/mcp-search-kivest/dist/index.js
```

**"Rate limit exceeded" errors**
- This is expected behavior (5 RPM limit)
- Requests are queued automatically
- The AI will wait for responses

### Debugging Tips

**Enable Verbose Logging:**

OpenCode:
```bash
export OPENCODE_DEBUG=1
opencode
```

Kilocode:
```bash
kilo --verbose
```

**Test Server Manually:**
```bash
# Should start and wait for input
node /path/to/mcp-search-kivest/dist/index.js
```

---

## Using with API Key (Optional)

An API key is **optional** and only needed for extended features or higher rate limits. Most users will not need one.

### Getting an API Key

1. Visit https://ai.ezif.in/api-key
2. Sign in with Google
3. Copy your API key

### Configuration with API Key

**OpenCode:**
```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "kivest-search": {
      "type": "local",
      "command": ["node", "/path/to/mcp-search-kivest/dist/index.js"],
      "enabled": true,
      "environment": {
        "KIVEST_API_KEY": "sk-kivest-xxxxxxxx"
      }
    }
  }
}
```

**Kilocode CLI:**
```json
{
  "mcp": {
    "kivest-search": {
      "type": "local",
      "command": ["node", "/path/to/mcp-search-kivest/dist/index.js"],
      "enabled": true,
      "environment": {
        "KIVEST_API_KEY": "sk-kivest-xxxxxxxx"
      },
      "timeout": 60000
    }
  }
}
```

**Kilocode VS Code:**
```json
{
  "mcpServers": {
    "kivest-search": {
      "command": "node",
      "args": ["/path/to/mcp-search-kivest/dist/index.js"],
      "env": {
        "KIVEST_API_KEY": "sk-kivest-xxxxxxxx"
      },
      "disabled": false
    }
  }
}
```

### Environment Variable Reference

Instead of hardcoding the API key, reference an environment variable:

**OpenCode & Kilocode:**
```json
{
  "environment": {
    "KIVEST_API_KEY": "{env:KIVEST_API_KEY}"
  }
}
```

Then set in your shell:
```bash
export KIVEST_API_KEY="sk-kivest-xxxxxxxx"
```

---

## Complete Examples

### OpenCode (opencode.json)

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "kivest-search": {
      "type": "local",
      "command": ["node", "/home/username/projects/mcp-search-kivest/dist/index.js"],
      "enabled": true
    }
  }
}
```

### Kilocode CLI (kilo.json)

```json
{
  "mcp": {
    "kivest-search": {
      "type": "local",
      "command": ["node", "/home/username/projects/mcp-search-kivest/dist/index.js"],
      "enabled": true,
      "timeout": 60000
    }
  }
}
```

### Kilocode VS Code (.kilocode/mcp.json)

```json
{
  "mcpServers": {
    "kivest-search": {
      "command": "node",
      "args": ["/home/username/projects/mcp-search-kivest/dist/index.js"],
      "disabled": false
    }
  }
}
```

---

## Next Steps

1. Build the project: `npm run build`
2. Get the absolute path to `dist/index.js`
3. Create configuration file in your project root
4. Start your AI assistant - MCP tools will be auto-discovered
5. Try searching: Ask your AI to "search for upcoming meteor showers"

## Resources

- Kivest Issues: https://github.com/yourusername/mcp-search-kivest/issues
- OpenCode Docs: https://opencode.ai/docs
- Kilocode Docs: https://kilocode.ai/docs
- MCP Protocol: https://modelcontextprotocol.io

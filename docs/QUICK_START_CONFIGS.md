# Quick Start Configs - Copy & Paste

Ready-to-use configuration files with your actual filesystem path.

**Your path:** `D:\_projects\mcp-search-kivest\dist\index.js`

---

## OpenCode

### Project Config (Recommended)

Create file: `D:\_projects\mcp-search-kivest\opencode.json`

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "kivest-search": {
      "type": "local",
      "command": ["node", "D:\_projects\mcp-search-kivest\dist\index.js"],
      "enabled": true
    }
  }
}
```

---

## Kilocode VS Code Extension

### Project Config (Recommended)

Create folder and file: `D:\_projects\mcp-search-kivest\.kilocode\mcp.json`

```json
{
  "mcpServers": {
    "kivest-search": {
      "command": "node",
      "args": ["D:\_projects\mcp-search-kivest\dist\index.js"],
      "alwaysAllow": [],
      "disabled": false
    }
  }
}
```

---

## With API Key (Optional)

### OpenCode

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "kivest-search": {
      "type": "local",
      "command": ["node", "D:\_projects\mcp-search-kivest\dist\index.js"],
      "enabled": true,
      "environment": {
        "KIVEST_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Kilocode VS Code

```json
{
  "mcpServers": {
    "kivest-search": {
      "command": "node",
      "args": ["D:\_projects\mcp-search-kivest\dist\index.js"],
      "env": {
        "KIVEST_API_KEY": "your-api-key-here"
      },
      "alwaysAllow": [],
      "disabled": false
    }
  }
}
```

---

## Steps to Use

1. **Build first:**
   ```bash
   npm run build
   ```

2. **Create the config file** for your AI assistant

3. **Start your AI assistant** in the project directory

4. **Test it:** Ask "What are upcoming celestial events?"

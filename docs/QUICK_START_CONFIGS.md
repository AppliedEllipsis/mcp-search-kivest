# Quick Start Configs - Copy & Paste

Ready-to-use configuration files with your actual filesystem path.

**Your path:** `D:\_projects\mcp-search-kivest\dist\index.js`

---

## OpenCode

### Option 1: Project Config (Recommended)

Create file: `D:\_projects\mcp-search-kivest\opencode.json`

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "kivest-search": {
      "type": "local",
      "command": ["node", "D:\\_projects\\mcp-search-kivest\\dist\\index.js"],
      "enabled": true
    }
  }
}
```

### Option 2: Global Config

Create file: `%USERPROFILE%\.config\opencode\opencode.json`

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "kivest-search": {
      "type": "local",
      "command": ["node", "D:\\_projects\\mcp-search-kivest\\dist\\index.js"],
      "enabled": true
    }
  }
}
```

---

## Kilocode

### Option 1: Project Config (Recommended)

Create file: `D:\_projects\mcp-search-kivest\kilo.json`

```json
{
  "mcp": {
    "kivest-search": {
      "type": "local",
      "command": ["node", "D:\\_projects\\mcp-search-kivest\\dist\\index.js"],
      "enabled": true,
      "timeout": 60000
    }
  }
}
```

### Option 2: VS Code Extension

Create file: `D:\_projects\mcp-search-kivest\.kilocode\mcp.json`

```json
{
  "mcpServers": {
    "kivest-search": {
      "command": "node",
      "args": ["D:\\_projects\\mcp-search-kivest\\dist\\index.js"],
      "disabled": false
    }
  }
}
```

### Option 3: Global Config

Create file: `%USERPROFILE%\.config\kilo\kilo.json`

```json
{
  "mcp": {
    "kivest-search": {
      "type": "local",
      "command": ["node", "D:\\_projects\\mcp-search-kivest\\dist\\index.js"],
      "enabled": true,
      "timeout": 60000
    }
  }
}
```

---

## With API Key (Optional)

Only if you need extended features. Most users skip this.

### OpenCode

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "kivest-search": {
      "type": "local",
      "command": ["node", "D:\\_projects\\mcp-search-kivest\\dist\\index.js"],
      "enabled": true,
      "environment": {
        "KIVEST_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Kilocode

```json
{
  "mcp": {
    "kivest-search": {
      "type": "local",
      "command": ["node", "D:\\_projects\\mcp-search-kivest\\dist\\index.js"],
      "enabled": true,
      "environment": {
        "KIVEST_API_KEY": "your-api-key-here"
      },
      "timeout": 60000
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

2. **Choose ONE config file** from above (project-level recommended)

3. **Create the file** with the content provided

4. **Start your AI assistant** in the project directory

5. **Test it:** Ask "What are upcoming celestial events?"

---

## Verify Build Exists

```bash
dir D:\_projects\mcp-search-kivest\dist\index.js
```

Should show the file exists. If not, run `npm run build`.

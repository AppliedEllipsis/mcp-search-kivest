# Kivest AI Search MCP Server

An MCP (Model Context Protocol) server that provides AI-powered search capabilities using the [Kivest AI Search API](https://se.ezif.in) with intelligent rate limiting and request queuing.

## Features

- 🤖 **AI-Powered Search**: Access multiple AI models (GPT-5.1, LLaMA 3.1, Claude, Gemini, etc.)
- ⏱️ **Smart Rate Limiting**: Global 5 RPM limit with automatic token bucket algorithm
- 🔄 **Request Queuing**: Automatic queuing and requeuing when rate limits are hit
- 📊 **Real-time Stats**: Monitor queue depth, tokens, and request statistics
- 🛡️ **Robust Error Handling**: Automatic retries with exponential backoff
- ⚡ **MCP Compatible**: Works with Claude Desktop, Cursor, and other MCP clients

## Installation

### Via npx (Recommended)

```bash
# Run directly without installation
npx @kivest/mcp-search
```

### Via npm

```bash
# Install globally
npm install -g @kivest/mcp-search

# Or install locally
npm install @kivest/mcp-search
```

### From Source

```bash
git clone https://github.com/yourusername/mcp-search-kivest.git
cd mcp-search-kivest
npm install
npm run build
```

## Configuration

### Get API Key

1. Visit [https://ai.ezif.in/api-key](https://ai.ezif.in/api-key)
2. Sign in with Google (no credit card required)
3. Copy your API key

### Environment Variables

```bash
export KIVEST_API_KEY="your-api-key-here"
```

### MCP Client Configuration

#### Claude Desktop

Add to your Claude Desktop config (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "kivest-search": {
      "command": "npx",
      "args": ["@kivest/mcp-search"],
      "env": {
        "KIVEST_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

**Config locations:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%/Claude/claude_desktop_config.json`
- Linux: `~/.config/Claude/claude_desktop_config.json`

#### Cursor

Add to Cursor MCP settings:

```json
{
  "mcpServers": {
    "kivest-search": {
      "command": "npx",
      "args": ["-y", "@kivest/mcp-search"],
      "env": {
        "KIVEST_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Available Tools

### `kivest_search`

Search the web using AI-powered search.

**Parameters:**
- `query` (required): The search query or question
- `model` (optional): AI model to use (default: `gpt-5.1`)
- `maxTokens` (optional): Maximum tokens in response (default: 1024)
- `temperature` (optional): Temperature 0-2 (default: 0.7)

**Example:**
```json
{
  "query": "What are the latest developments in quantum computing?",
  "model": "gpt-5.1",
  "maxTokens": 500
}
```

**Available Models:**

| Model | RPM | Description |
|-------|-----|-------------|
| `gpt-5.1` | 4 | Fast, high-quality results |
| `llama3.1-8B` | Unlimited | Open source Meta model |
| `deepseek-chat` | 8 | Balanced speed and quality |
| `qwen3.5-plus` | 8 | Latest Qwen model |
| `claude-sonnet-4.6` | 1 | Anthropic's latest |
| `gemini-3-flash-preview` | 1 | Google's fast model |
| `kimi-k2.5` | 2 | Moonshot AI |

### `kivest_stats`

Get current rate limiter statistics.

**Returns:**
```json
{
  "queued": 0,
  "running": 1,
  "done": 10,
  "failed": 0,
  "totalRequests": 10,
  "successfulRequests": 10,
  "rateLimitedRequests": 2
}
```

### `kivest_models`

List all available AI models and their rate limits.

## Rate Limiting

This MCP server implements a **Token Bucket** rate limiter with the following features:

- **Global Limit**: 5 requests per minute (configurable)
- **Queue Size**: Up to 50 requests can be queued
- **Automatic Retry**: Requests that hit rate limits are automatically requeued
- **Smart Backoff**: Exponential backoff with Retry-After header support
- **Priority Queue**: Higher priority requests are processed first

When the rate limit is exceeded:
1. New requests are queued
2. Requests are processed as tokens become available
3. Rate-limited requests are automatically retried
4. Maximum 3 retry attempts before failing

## Testing

### Run Tests

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Set your API key
export KIVEST_API_KEY="your-api-key"

# Run basic tests
npm test

# Run stress tests
npm run test:stress
```

### Test Output

The test suite validates:
- ✅ Endpoint connectivity
- ✅ Request/response payloads
- ✅ Model selection
- ✅ Rate limiting behavior
- ✅ Queue management
- ✅ Automatic requeuing
- ✅ Stress testing under load

## Publishing to npm

### 1. Prepare for Publishing

```bash
# Update version
npm version patch  # or minor, major

# Build the project
npm run build

# Verify package contents
npm pack --dry-run
```

### 2. Login to npm

```bash
npm login
```

### 3. Publish

```bash
# Publish to npm
npm publish --access public

# If using npx, ensure bin is properly configured
```

### 4. Verify Installation

```bash
# Test published package
npx @kivest/mcp-search --help
```

## Development

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-search-kivest.git
cd mcp-search-kivest

# Install dependencies
npm install

# Start development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Project Structure

```
mcp-search-kivest/
├── src/
│   ├── index.ts           # Main MCP server entry
│   ├── kivest-client.ts   # API client with rate limiting
│   ├── rate-limiter.ts    # Token bucket implementation
│   ├── test.ts           # Test suite
│   └── stress-test.ts    # Stress tests
├── dist/                  # Compiled output
├── package.json
├── tsconfig.json
└── README.md
```

## API Reference

### Kivest AI Search API

- **Base URL**: `https://ai.ezif.in/v1`
- **Documentation**: `https://ai.ezif.in/docs`
- **Models**: `https://ai.ezif.in/v1/models`

### Rate Limits

| Endpoint | Limit |
|----------|-------|
| Global | 5 RPM |
| Burst | 5 per 10 seconds |

## Troubleshooting

### "Rate limit exceeded"
- The server automatically queues and retries requests
- Check `kivest_stats` to see queue status
- Use `llama3.1-8B` model for unlimited requests

### "KIVEST_API_KEY not set"
- Ensure the environment variable is set
- Check your MCP client configuration
- Verify the API key at [https://ai.ezif.in/api-key](https://ai.ezif.in/api-key)

### "Queue is full"
- Maximum queue size is 50 requests
- Wait for queued requests to complete
- Check `kivest_stats` for queue status

## License

MIT

## Contributing

Contributions welcome! Please read the [Contributing Guide](CONTRIBUTING.md) first.

## Support

- Discord: [https://discord.gg/z6bZZF4rme](https://discord.gg/z6bZZF4rme)
- Issues: [GitHub Issues](https://github.com/yourusername/mcp-search-kivest/issues)

---

Built with ❤️ for the MCP community

# Kivest AI Search MCP Server

An MCP (Model Context Protocol) server that provides free AI-powered search capabilities using the [Kivest AI Search API](https://se.ezif.in) with intelligent rate limiting and request queuing.

## Features

- 🤖 **AI-Powered Search**: Access multiple AI models (GPT-5.1, LLaMA 3.1, Claude, Gemini, etc.)
- ⏱️ **Smart Rate Limiting**: Global 5 RPM limit with automatic token bucket algorithm
- 🔄 **Request Queuing**: Automatic queuing and requeuing when rate limits are hit
- 📊 **Real-time Stats**: Monitor queue depth, tokens, and request statistics
- 🛡️ **Robust Error Handling**: Automatic retries with exponential backoff
- ⚡ **MCP Compatible**: Works with Claude Desktop, Cursor, and other MCP clients

## Discord / Contact
Please visit Kivest's discord server for all their amazing free and paid AI Offerings.
https://discord.gg/kivestai


## Installation

### Via npx (Not Recommended)

```bash
# Run directly without installation
# npxx @blah/mcp--search-kiveefewfest
```

### Via npm (not functional yet, use from source)

```bash
# Install globally
# npmx install -g @blah/mcp--search-kivestvlaa

# Or install locally
# npmx install @blah/mcp--blahsearch-kivestvlah
```

### From Source

```bash
git clone https://github.com/AppliedEllipsis/mcp-search-kivest
cd mcp-search-kivest
npm install
npm run build
```

## Configuration

The Kivest MCP server works without an API key by default. The API key is only required for certain features or higher rate limits.

### Optional: Get API Key

If you need an API key for extended features:

1. Visit [https://ai.ezif.in/api-key](https://ai.ezif.in/api-key)
2. Sign in with Google (no credit card required)
3. Copy your API key

### Environment Variables (Optional)

```bash
# Only needed if using an API key
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
      "args": ["@kivest/mcp-search"]
    }
  }
}
```

**With API Key (optional):**
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
      "args": ["-y", "@kivest/mcp-search"]
    }
  }
}
```

**With API Key (optional):**
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

AI-powered search with comprehensive answers.

**Parameters:**
- `query` (required): The search query or question
- `model` (optional): AI model to use (default: `gpt-5.1`)
- `maxTokens` (optional): Maximum tokens in response (default: 1024)
- `temperature` (optional): Temperature 0-2 (default: 0.7)

### `kivest_web_search`

Traditional web search with results (titles, URLs, snippets).

**Parameters:**
- `query` (required): The search query

**Returns:** List of web results with title, URL, and snippet.

### `kivest_image_search`

Search for images across the web.

**Parameters:**
- `query` (required): The image search query

**Returns:** List of images with URLs, resolutions, and sources.

### `kivest_video_search`

Search for videos across platforms.

**Parameters:**
- `query` (required): The video search query

**Returns:** List of videos with thumbnails and metadata.

### `kivest_news_search`

Search for news articles.

**Parameters:**
- `query` (required): The news search query

**Returns:** List of news articles with publication dates and sources.

### `kivest_scrape_web`

Scrape a website and return clean markdown (perfect for AI use).

**Parameters:**
- `url` (required): The URL to scrape

**Returns:** Clean markdown content from the webpage.

### `kivest_usage`

Get usage statistics for your API calls.

**Returns:** Total requests and breakdown by endpoint.

### `kivest_stats`

Get current rate limiter statistics.

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
4. Maximum **10 retry attempts** before failing completely
5. Priority-based retry queue - sorted by initial request time
6. Random 1-10 second cooldown delays during rate limit recovery

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
- ✅ Endpoint connectivity (7 endpoints: AI search, web, images, videos, news, web scrape, usage)
- ✅ Request/response payloads
- ✅ Model selection (GPT-5.1, LLaMA 3.1, Claude, Gemini, DeepSeek)
- ✅ Rate limiting behavior with 5 RPM limit
- ✅ Queue management and overflow handling
- ✅ Automatic requeuing with priority-based retry
- ✅ Cooldown delays during rate limit recovery
- ✅ Stress testing under load
- ✅ Concurrent request handling
- ✅ Individual vs concurrent query performance

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
│   ├── index.ts              # Main MCP server entry
│   ├── kivest-client.ts      # API client with all endpoints
│   ├── rate-limiter.ts       # Token bucket implementation
│   ├── test.ts              # Basic test suite
│   ├── comprehensive-test.ts # Full test suite with all endpoints
│   ├── test-celestial.ts    # Celestial events search test
│   ├── test-aggressive.ts   # Aggressive rate limit test
│   └── stress-test.ts       # Stress tests
├── dist/                     # Compiled output
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
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
- This is optional - the server works without an API key
- If using an API key, ensure the environment variable is set
- Verify the API key at [https://ai.ezif.in/api-key](https://ai.ezif.in/api-key)

### "Queue is full"
- Maximum queue size is 50 requests
- Wait for queued requests to complete
- Check `kivest_stats` for queue status

## License

MIT

## Contributing

Contributions welcome! Please read the [Contributing Guide](CONTRIBUTING.md) first.


### Support This Project ❤️

If you find this extension useful, then please support its continued development:

**Crypto Donation**

If you'd prefer to donate directly via cryptocurrency, you can send Bitcoin to:

```
bc1q8nrdytlvms0a0zurp04xwfppflcxwgpyrzw5hn
```

Thank you for supporting free and open source software! 🙏

---

_Co-vibe coded with AI - Built with human creativity enhanced by artificial intelligence_
